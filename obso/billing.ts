// This is th old billing class and would be deprecated in the endin of 2025
import { IDetermineStageOfRefund, updateRefundCashRequestBodyType } from "../src/controllers/billing/sales/type";
import { PrimeLimsTablebilling, PrimeLimsTablebillinghx, PrimeLimsTabledbobillingrefundtable, PrimeLimsTabledboservices, PrimeLimsTablepaymentmodes } from "../src/database/DatabaseTableSchema";
import KnexConnection from "../src/database/KnexConnections";
import { applyDboservicesAfterInsert, applyDboservicesAfterUpdate, applyTestAscensionAfterInsertApprovalSettings } from "../src/database/appLevelTriggers";
import { TiifuWorkingClass } from "../src/database/TiifuWorkingClass";
import { promisifyQuery, rowAffected } from "../src/hooks/helper";
import { testpanel } from "../src/testpanel/testpanelList";
import ApplicationSettings from "../src/models/application/appsettings/appset";
import { TestAscension } from "../src/models/operations/ascension";
import { OperationsFailures } from "../src/models/operations/types";
import Organization from "../src/models/organization/organization";
import OrganizationalBilling from "../src/models/organization/organizationBilling";
import Outsourcing from "../src/models/organization/outsourcingOrganization/outsourcing";
import Registration from "../src/models/registration/registration";
import { Services } from "../src/models/services/services";
import { billErrors, BillingValidationResult, Pagination, serviceCategory, ServiceEntry, servicesProvided, TBillingData, TestCart, testServicesProvided } from "../src/models/billing/billingclientTypes";
import {
	AddtoTestAscenstionQuery,
	currentDateBilledClients,
	deleteAscensionidQuery,
	deleteBillTransactionQuery,
	deleteNewBillPaymentHx,
	insertbillHistoryQuery,
	patientBilledTodayQuery,
	q_get_today_client_billingid,
	q_insert_new_services_billing_test,
	q_update_Billing_Information,
	updatebillHistoryQuery
} from "../src/models/billing/queries";
import { Refund } from "../src/models/billing/RefundClass";
import { enqueueBillingRefund } from "../src/accountingModule/integrations/BillingAccounting";
import { minorUnits } from '../src/accountingModule/utils/money';
import { CommissionTrackingRepository } from '../src/models/commissions/commission-configurations/repositories/CommissionTrackingRepository';
import { FinancialFinalizationGuard } from '../src/accountingModule/services/FinancialFinalizationGuard';




const N = 2;
export class Billing {
	readonly patientid: number;

	constructor(patientid: number) {
		this.patientid = patientid;
	}

	private async insertTestBillingAsAServices(
		tenantId: number,
		discountedValue: number,
		testid: number,
		isOutsourced: boolean,
		outsourceid = null,
		totalcost: number,
		data: testServicesProvided
	): Promise<boolean | number> {
		try {
			const { billingid, employeeid, serviceCategory, categoryTrackId,
				type, clinicianId, organizationId, branchid, taxIncluded = 0, taxList = null, taxValue = 0, amountIncurredDueTax = 0, insuranceId } = data;
			const isPHIS = categoryTrackId == 3 ? 1 : 0

			const isServiced = await promisifyQuery(tenantId,
				q_insert_new_services_billing_test, [
				billingid, testid, discountedValue, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, type, branchid, isOutsourced, outsourceid, taxList, amountIncurredDueTax, taxValue, taxIncluded, totalcost, 0, isPHIS, insuranceId, null
			]);
			return rowAffected(isServiced) ? isServiced.insertId : false;
		} catch (err: any) {
			console.log(err)
			return false;
		}
	}



	public async determineStageOfRefundRequest(
		tenantId: number,
		data: IDetermineStageOfRefund): Promise<any> {
		try {
			const { categoryTrackId, serviceid, serviceCategoryName } = data;
			let stage = null;

			if ([2, 1, 3, 4, 6].includes(categoryTrackId) && serviceCategory[categoryTrackId] === serviceCategoryName) {
				const { id: ascensionId } = await new TiifuWorkingClass('test_ascension').findOne(tenantId, 'serviceid', serviceid);
				if (ascensionId) {
					stage = await TestAscension.determineStage(tenantId, ascensionId);
					return stage
				}
				return ascensionId;
			}

			if (categoryTrackId === 5 && serviceCategory[categoryTrackId] === serviceCategoryName) {
				stage = await new Services(serviceid).getServiceProgress(tenantId);
			}
			return stage;
		} catch (err: any) {
			console.log(err);
			return null;
		}
	}

	public async getClientBillingInformation(tenantId: number, billingid: number) {
		if (!billingid) throw new Error("billingid not provided");
		if (typeof billingid !== "number") throw new TypeError("billingid must be a number");
		const connection = await KnexConnection(tenantId);
		const servicesProfile: PrimeLimsTablebilling[] = await connection('dboservices')
			.select('dboservices.*', 'dbobillingrefundtable.*', 'organization.name as organizationName',
				'clinicianbasicinfo.name as clinicianName', 'roles_first.username as witnessName',
				'roles_initiated.username as initiatedByName', 'deleted_by_role.username as deletedByName',
				'roles_approved.username as approvedByName')
			.leftJoin('dbobillingrefundtable', 'dboservices.serviceid', 'dbobillingrefundtable.serviceid')
			.leftJoin('organization', 'dboservices.organizationId', 'organization.id')
			.leftJoin('clinicianbasicinfo', 'dboservices.clinicianId', 'clinicianbasicinfo.id')
			.leftJoin('roles as roles_initiated', 'dbobillingrefundtable.initiatedBy', 'roles_initiated.employeeid')
			.leftJoin('roles as roles_approved', 'dbobillingrefundtable.approvedby', 'roles_approved.employeeid')
			.leftJoin('roles as roles_first', 'dbobillingrefundtable.firstWitness', 'roles_first.employeeid')
			.leftJoin('roles as deleted_by_role', 'dboservices.isdeletedBy', 'deleted_by_role.employeeid')
			.where({ billingid })
			.orWhere({ relatedbillingid: billingid });
		if (servicesProfile.length === 0) return [];
		const previousRecords = await this.diffentiateBilledToIndividualServices(tenantId, servicesProfile);
		return previousRecords
	}

	static async totalRecordedPayment(tenantId: number, billingid: number): Promise<{ totalDebit: number; totalCredit: number; totalPayment: number; allPayment: number } | boolean | string> {
		if (!billingid) return OperationsFailures.notFound;

		const billinghxRecords: PrimeLimsTablebillinghx[] = await new TiifuWorkingClass("billinghx").findMany(tenantId, "billingid", billingid);

		if (billinghxRecords.length == 0) return false;

		let totalDebit = 0;
		let totalCredit = 0;

		billinghxRecords.forEach((record) => {
			if (record.type === 'debit') {
				totalDebit += parseFloat(record.Amount.toString());
			} else {
				totalCredit += parseFloat(record.Amount.toString());
			}
		});

		totalDebit = parseFloat(totalDebit.toFixed(2));
		totalCredit = parseFloat(totalCredit.toFixed(2));

		const totalPayment = parseFloat((totalCredit - totalDebit).toFixed(2));
		const allPayment = parseFloat((totalDebit + totalCredit).toFixed(2));

		return {
			totalDebit,
			totalCredit,
			totalPayment,
			allPayment
		};
	}



	public diffentiateBilledToIndividualServices(tenantId: number, servicesList: any) {
		return Promise.all(
			servicesList.map(async (item: any) => {
				const addVitalInformation = async function (item: any) {
					const { isoutsourced, trackId, categoryTrackId, serviceAddedOn, outsourceid, organizationId } = item;
					let OutSourcingOrganization: any = [];
					let outsouring_organization = null;

					if (isoutsourced == 1 && outsourceid) {
						OutSourcingOrganization = await new Outsourcing(null as any, null as any).getOrganizationBasicInformation(tenantId, outsourceid);

						if (Array.isArray(OutSourcingOrganization) && OutSourcingOrganization.length > 0) {
							outsouring_organization = OutSourcingOrganization[0]?.['name'];
						}
					}

					switch (categoryTrackId) {
						case 1:
						case 4:
							let testname1 = await testpanel.getTestUsingTestid(tenantId, trackId);
							return { ...item, outsourcingOrganization: outsouring_organization, name: testname1 };

						case 5:
							const servicenformation: any = await new Services(trackId).getAService(tenantId);
							let testname5 = await testpanel.getTestUsingTestid(tenantId, trackId);
							return !servicenformation || servicenformation.length === 0
								? { ...item, name: testname5 }
								: { ...item, name: servicenformation[0]?.['serviceName'], testname: testname5 };

						case 2:
							const organizationalBillingName = await new OrganizationalBilling(organizationId).getOrganizationBasic(tenantId);
							let testName2 = await testpanel.getTestUsingTestid(tenantId, item.trackId);
							return organizationalBillingName.length === 0
								? { ...item, name: testName2 }
								: { ...item, outsourcingOrganization: outsouring_organization, organizationName: organizationalBillingName[0]['name'], name: testName2 };

						case 3:
							let testname3 = await testpanel.getTestUsingTestid(tenantId, trackId);
							return { ...item, name: testname3 };

						case 6:
							let testname6 = await testpanel.getTestUsingTestid(tenantId, trackId);
							return { ...item, name: testname6 };
						default:
							return [];
					}

				};
				const records = await addVitalInformation(item);
				const witnesses = await Refund.getservicesRefundWithness(tenantId, item.serviceid);
				return { ...records, witnesses };
			})
		)
	}

	public async getTransactionBillData(tenantId: number, billingid: number) {
		return await promisifyQuery(tenantId, `SELECT * FROM billing WHERE billingid = ? `, [billingid]);
	}

	public async getBranchDayBilledClients(tenantId: number, branchid: number, { count = 10, page = 1 }: Pagination): Promise<[]> {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const month = currentDate.getMonth();
		const day = currentDate.getDate();
		const result: [] = await promisifyQuery(tenantId, currentDateBilledClients, [currentYear, month, day, branchid]);
		return result;
	}


	public async generateBillingid(tenantId: number, patientid: number, trx?: any): Promise<number | undefined> {
		try {
			const connection = await KnexConnection(tenantId);
			const query = trx || connection;
			const [billingId] = await query("billing")
				.insert({ patientid })
				.returning('billingid');
			if (typeof billingId === 'number') {
				return billingId;
			} else {
				throw new Error('Failed to generate billingid: Invalid billingid returned');
			}
		} catch (error: any) {
			console.error('Error generating billingid:', error);
			return undefined;
		}
	}



	private static calculateBillingVariablesFinal(
		services: any[],
		test: any[],
		taxValue: number,
		serviceCategoryTrackId: number,
		testCategoryTrackId: number,
		paid: number
	): { payable: number, outstanding: number, totalDiscount: number, amountIncurredDueTax: number, totalcost: number } {

		const payableofTest = Billing.calulateTotalPayableServices(testCategoryTrackId, test as any, taxValue);

		const payableofServices = Billing.calulateTotalPayableServices(serviceCategoryTrackId, services as any, taxValue);

		const { amountIncurredDueTax: a1, totalDiscount: d1, payable: p1, totalServiceCost: t1, totalcost: v1 } = payableofTest;
		const { amountIncurredDueTax: a2, totalDiscount: d2, payable: p2, totalServiceCost: t2, totalcost: v2 } = payableofServices;

		let payable = parseFloat((p1 + p2).toFixed(2));
		let amountIncurredDueTax = parseFloat((a1 + a2).toFixed(2));
		let totalDiscount = parseFloat((d1 + d2).toFixed(2));
		let outstanding = parseFloat((payable - paid).toFixed(2));
		let totalcost = parseFloat((v1 + v2).toFixed(2));

		return { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost };
	}

	private async verificationAndReformatingOfTestAndPrice(
		tenantId: number,
		item: TestCart,
		categoryTrackId: number,
		associate: {
			organizationId: number | null,
			insuranceId: number | null,
			clinicianId: number | null
		}
	) {
		try {
			const { organizationId, insuranceId, clinicianId } = associate;

			const { testid, id, organization, discount } = item;
			const trackId = testid ? testid : id;

			let outsourceid = null;
			let isOutsourced = false;
			let price = null;
			let serviceid = null;
			let amountIncurredDueTax = 0;
			let ascensionId = null;

			const hasOrganization = organization && organization.hasOwnProperty("outsourceid");

			if (hasOrganization) {
				outsourceid = organization.outsourceid;
				isOutsourced = true;
			}

			if (categoryTrackId == 1) {
				const testpanel = await new TiifuWorkingClass("test_panels").findOne(tenantId, "id", trackId);
				price = testpanel['price'];
			}

			if (categoryTrackId == 2) {
				price = await this.getTestOrganizationPriceValue(tenantId, organizationId, trackId, price);
			}

			if (categoryTrackId === 3) {
				// const { discountedValue, isoutsourced } = await new ClinicianBillingStrategy().getStrategySingleTestValue(tenantId, insuranceId, 'phis', trackId) as unknown as {
				// 	discountedValue: number, isoutsourced:number
				// }
				// price = discountedValue;
				// isOutsourced = isoutsourced == 1;
			}

			if (categoryTrackId === 6) {
				// const { discountedValue, isoutsourced } = await new ClinicianBillingStrategy().getStrategySingleTestValue(tenantId, clinicianId, 'clinicians', trackId);

				// if (discountedValue >= 0) {
				// 	price = discountedValue;
				// 	isOutsourced = isoutsourced == 1;
				// }
			}

			let parsedDiscount = discount ? discount : 0;


			return {
				amountIncurredDueTax,
				discountedValue: price,
				serviceid,
				trackId,
				isOutsourced,
				outsourceid,
				ascensionId,
				discount: parsedDiscount
			};
		} catch (error: any) {
			throw error;
		}
	}

	private applyNightAdjustmentToItems<T extends {
		discountedValue: number | null;
		hasNightAdjustment: boolean;
		nightAdjustmentMode: 'percentage' | 'absolute' | 'none';
		nightAdjustmentValue: number;
	}>(items: T[]): T[] {
		return items.map(item => {
			if (
				item.hasNightAdjustment &&
				item.discountedValue !== null &&
				!isNaN(item.discountedValue)
			) {
				if (item.nightAdjustmentMode === 'absolute') {
					item.discountedValue += item.nightAdjustmentValue;
				} else if (item.nightAdjustmentMode === 'percentage') {
					item.discountedValue *= (item.nightAdjustmentValue / 100);
				}
			}
			return item;
		});
	}


	private async billClient(tenantId: number, data: TBillingData, taxValue: number, taxList: any): Promise<number | boolean> {
		let billingid = null;
		let trx;
		try {
			const {
				patientid, cart, servicesProvided, paid, taxValue,
				billingSource, organizationId, insuranceId, clinicianId, employeeid, type, samplingCenter, taxIncluded, isPackageUsed
			} = data;

			const connection = await KnexConnection(tenantId);
			trx = await connection.transaction();
			billingid = await this.generateBillingid(tenantId, patientid, trx);

			const applyNightAdjustmentToTestCartItems = await this.verificationOfTestAndNightAdjustment(tenantId, cart, billingSource, organizationId, insuranceId, clinicianId, taxValue, isPackageUsed);

			const values = await this.processTestCart(applyNightAdjustmentToTestCartItems as any, billingSource, organizationId, insuranceId, clinicianId, taxValue, billingid, employeeid, type, samplingCenter, taxList, taxIncluded, isPackageUsed);

			const applyNightAdjustmentToServiceItems = await this.verificationOfServicesAndNightAdjustment(tenantId, servicesProvided, 5, taxValue, isPackageUsed);

			const services = await this.processServicesCart(applyNightAdjustmentToServiceItems, billingid, data, taxList);

			let allEntries = [...values, ...services];

			if (allEntries.length > 0) {
				const billing_final_values = Billing.calculateBillingVariablesFinal(applyNightAdjustmentToServiceItems, applyNightAdjustmentToTestCartItems, taxValue, 5, billingSource, paid);

				const loadAllServices = await this.mapAndInsertServices(tenantId, allEntries, billingid, trx);

				if (loadAllServices.length > 0) {
					throw new Error(billErrors.unableToLoadServices);
				}

				const { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost } = billing_final_values;

				const isUpdated = await trx('billing')
					.where({ billingid })
					.update({
						totalTransactionCost: totalcost,
						totalcost,
						paid,
						payable,
						discount: totalDiscount,
						amountIncurredDueTax,
						outstanding,
						balance: 0,
						totalRefunded: 0,
					});

				if (!isUpdated) {
					throw new Error(billErrors.unableToUpdateBilling);
				}

				await trx.raw(insertbillHistoryQuery, [billingid, data.paymentmode, data.paid, data.employeeid, data.type]);
				await trx.commit();
				return billingid
			}
			return billingid;
		} catch (err: any) {
			console.log(err)
			await trx.rollback();
			throw new Error(billErrors.error);
		}
	}




	private async mapAndInsertServices(tenantId: number, allEntries: ServiceEntry[], billingid: number, trx?: any) {
		try {
			const servicesMap = allEntries.map((service) => {
				return [
					service.billingid,
					service.trackId,
					service.cost,
					service.employeeid,
					service.serviceCategory,
					service.categoryTrackId,
					service.clinicianId,
					service.organizationId,
					service.registrationType,
					service.branchid,
					service.isoutsourced || 0,
					service.outsourceid || null,
					service.serviceAddedOn,
					service.taxList,
					service.taxValue,
					service.amountIncurredDueTax,
					service.taxIncluded,
					service.discount,
					service.totalcost,
					service.totalpayable,
					service.isNHIS,
					service.isPHIS,
					service.insuranceid,
					service.claimCode,
					service.hasNightAdjustment,
					service.nightAdjustmentMode,
					service.nightAdjustmentValue,
					service.isPackageUsed,
					service.packageid
				];
			});

			const loadAllServices = await this.loadMultipleServices(servicesMap, billingid, tenantId, trx);
			return loadAllServices;
		} catch (err: any) {
			console.log('Error Loading services ')
			throw err;
		}
	}

	private async verificationOfServicesAndNightAdjustment(tenantId: number, servicesProvided: servicesProvided[], billingSource: number = 5, taxValue: number, isPackageUsed: boolean) {
		let verifyAndReformatServices = servicesProvided;

		if (!isPackageUsed) {
			verifyAndReformatServices = await Promise.all(
				servicesProvided.map(async (item, index) => {
					const result = await this.verificationAndReformatingOfServics(tenantId, item);
					return { ...item, ...result };
				})
			);

			const applyNightAdjustmentToServiceItems = this.applyNightAdjustmentToItems(verifyAndReformatServices as any);

			return applyNightAdjustmentToServiceItems.map((item, index) => {
				const summary = Billing.calulateTotalPayableServices(billingSource, [item], taxValue);
				return { ...summary, ...item };
			})

		} else {

			return servicesProvided.map((item, index: number) => {
				const summary = Billing.calulateTotalPayableServices(billingSource, [item], taxValue);
				return { ...summary, ...item };
			})
		}



	}

	private async processTestCart(cart: TestCart[], billingSource: number, organizationId: number, insuranceId: number, clinicianId: number, taxValue: number, billingid: any, employeeid: number, type: string, samplingCenter: number, taxList: any, taxIncluded: boolean, isPackageUsed: boolean) {
		return await Promise.all(
			cart.map(async (item) => {
				const { hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue, isoutsourced, isOutsourced } = item;

				return {
					billingid,
					trackId: item.testid,
					cost: item.discountedValue,
					employeeid,
					serviceCategory: serviceCategory[billingSource],
					categoryTrackId: billingSource,
					clinicianId,
					organizationId,
					registrationType: type,
					branchid: samplingCenter,
					isoutsourced: isoutsourced || isOutsourced,
					outsourceid: item.outsourceid || null,
					serviceAddedOn: new Date(),
					taxList,
					taxValue,
					amountIncurredDueTax: item.amountIncurredDueTax,
					taxIncluded,
					discount: item.discount,
					totalcost: item.totalcost,
					totalpayable: item.payable,
					isNHIS: billingSource === 4 ? 1 : 0,
					isPHIS: billingSource === 3 ? 1 : 0,
					insuranceid: insuranceId || null,
					claimCode: null,
					hasNightAdjustment: hasNightAdjustment ? 1 : 0,
					nightAdjustmentMode,
					nightAdjustmentValue,
					isPackageUsed: isPackageUsed ? 1 : 0,
					packageid: item?.package_id
				};
			})
		);
	}

	private async verificationOfTestAndNightAdjustment(
		tenantId: number,
		cart: TestCart[],
		billingSource: number,
		organizationId: number,
		insuranceId: number,
		clinicianId: number,
		taxValue: number,
		isPackageUsed: boolean
	) {
		let details = cart;

		if (!isPackageUsed) {
			details = await Promise.all(cart.map(async (item, index) => {
				const result = await this.verificationAndReformatingOfTestAndPrice(
					tenantId,
					item, billingSource, {
					organizationId,
					insuranceId,
					clinicianId
				})
				return { ...item, ...result }
			}))


			const applyNightAdjustmentToItems = this.applyNightAdjustmentToItems(details as any);

			const summary = applyNightAdjustmentToItems.map((_single, index) => {
				const summary = Billing.calulateTotalPayableServices(
					billingSource,
					[_single],
					taxValue
				);
				return { ..._single, ...summary };
			})


			return summary;
		} else {
			return cart.map((_single, index) => {
				const summary = Billing.calulateTotalPayableServices(
					billingSource,
					[_single],
					taxValue
				);
				return { ..._single, ...summary };
			})
		}





	}



	private async processServicesCart(
		applyNightAdjustmentToServiceItems,
		billingid: number,
		billingdata: TBillingData,
		taxList: any
	): Promise<ServiceEntry[]> {
		const { organizationId, clinicianId, employeeid, samplingCenter, taxValue, taxIncluded, type, billingSource, insuranceId, isPackageUsed } = billingdata;

		return await Promise.all(
			applyNightAdjustmentToServiceItems.map(async (item) => {
				return {
					billingid,
					trackId: item.keyid,
					cost: item.discountedValue,
					employeeid,
					serviceCategory: serviceCategory[5],
					categoryTrackId: 5,
					clinicianId,
					organizationId,
					registrationType: type,
					branchid: samplingCenter,
					isoutsourced: 0,
					outsourceid: 0,
					serviceAddedOn: new Date(),
					taxList,
					taxValue,
					amountIncurredDueTax: item.amountIncurredDueTax,
					taxIncluded,
					discount: item.totalDiscount,
					totalcost: item.totalcost,
					totalpayable: item.payable,
					isNHIS: billingSource === 4 ? 1 : 0,
					isPHIS: billingSource === 3 ? 1 : 0,
					insuranceid: insuranceId || null,
					claimCode: null,
					hasNightAdjustment: item.hasNightAdjustment,
					nightAdjustmentMode: item.nightAdjustmentMode,
					nightAdjustmentValue: item.nightAdjustmentValue,
					isPackageUsed: isPackageUsed ? 1 : 0,
					packageid: item?.package_id || null,
				};
			})
		);
	}

	public async isCompleteFlow(tenantId: number): Promise<boolean> {
		const settings = await promisifyQuery(tenantId, `SELECT * FROM applicationsettings`);
		return settings.length == 0 ? false : settings[0]["completeFlow"] == 1;
	}


	private static async updateBillingInformation(
		tenantId: number,
		payable: number,
		paid: number,
		amountIncurredDueTax: number,
		outstanding: number,
		balance: number,
		discount: number,
		billingid: number,
		totalRefunded: number,
		totalcost: number,
		transactioncost: number
	) {
		const values = [paid, payable, outstanding, discount, amountIncurredDueTax, balance, totalRefunded, totalcost, transactioncost, billingid];

		const result = await promisifyQuery(tenantId, q_update_Billing_Information, values);
		return rowAffected(result);
	}


	public async updateBillingHistory(tenantId: number, paymentmode: number, billingid: number, amount: number): Promise<any> {
		const values: [number, number, number] = [paymentmode, amount, billingid];
		return await promisifyQuery(tenantId, updatebillHistoryQuery, values);
	}

	public async insertBillingHistory(tenantId: number, paymentmode: number, billingid: number, amount: number, employeeid: number, type = "credit"): Promise<any> {
		try {
			const values: [number, number, number, number, string] = [billingid, paymentmode, amount, employeeid, type];
			return await promisifyQuery(tenantId, insertbillHistoryQuery, values);
		} catch (err: any) {
			throw err;
		}
	}

	public async deleteBillingHistory(tenantId: number, billingid: number) {
		if (billingid) return false;
		return await promisifyQuery(tenantId, deleteNewBillPaymentHx, [billingid]);
	}


	public async updateApprovalStatus(tenantId: number, ascensionId: number): Promise<any> {
		try {
			const query = `UPDATE samplestatus SET approvalstatus = 1 WHERE ascensionid = ?`;
			const values = [ascensionId];
			return promisifyQuery(tenantId, query, values);
		} catch (err: any) {
			throw new Error(err);
		}
	}


	public async deleteTestAscension(tenantId: number, serviceid: number, testid: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId,
			deleteAscensionidQuery, [serviceid, testid]);
		return rowAffected(result);
	}


	public async haveBeenBilledToday(tenantId: number, patientid: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, patientBilledTodayQuery, [patientid]);
		return !(result[0]["count"] > 0);
	}

	public async getClientTodayBillingid(tenantId: number, patientid: number): Promise<number | boolean> {
		const result = await promisifyQuery(tenantId, q_get_today_client_billingid, [patientid]);
		if (result.length == 0) return false;
		return result[0]['billingid']
	}



	public async deleteBillTransaction(tenantId: number, billingid: number): Promise<any> {
		return await promisifyQuery(tenantId, deleteBillTransactionQuery, [billingid]);
	}


	async cleanUpRecordedPaymentHx(tenantId: number, billingid: number): Promise<void> {
		await promisifyQuery(tenantId, deleteNewBillPaymentHx, [billingid]);
	}


	private static async inCompleteFlowTestAscensionUpdate(employeeid: number, date: Date, ascensionId: number) {
		try {
			// const testAscensionClass = new TestAscension(ascensionId);
			// await testAscensionClass.updateTestAscensionStatus("collectionStartDate", new Date(), employeeid);
			// await testAscensionClass.updateTestAscensionStatus("collectionEndDate", new Date(), employeeid);
			// await new Billing(null).updateApprovalStatus(ascensionId);
			// await testAscensionClass.updateTestAscensionStatus("processingStartDate", new Date(), employeeid);
			// await testAscensionClass.updateTestAscensionStatus("processingEndDate", new Date(), employeeid);
		} catch (err: any) {
			throw err;
		}
	}






	private static getBilledTaxValues(packet) {
		if (packet.hasOwnProperty("taxList") === false) return 0;
		const { taxList } = packet;
		let parsedPacketTaxList = JSON.parse(taxList);
		if (Array.isArray(parsedPacketTaxList) && parsedPacketTaxList.length > 0) {
			parsedPacketTaxList = parsedPacketTaxList.reduce((a, b) => a + b.value, 0)
		}
		return parsedPacketTaxList;
	}

	public static async checkValidityOfBillingid(tenantId: number, billingid: number): Promise<boolean> {
		const result = await new TiifuWorkingClass('billing').findOne(tenantId, "billingid", billingid);
		return result && result.billingid == billingid;
	}



	public static async getTotalPriceFromSavedServices(
		tenantId: number,
		billingid: number,
		refundInclusive: boolean
	): Promise<{
		totalDiscount: number;
		totalCost: number;
		totalAmountIncurredDueTax: number;
		totalPayable: number;
		totalRefunded: number;
		transactioncost: number;
	}> {
		const query = refundInclusive
			? `
        SELECT
            COALESCE(SUM(ss.totalcost), 0) AS totalCost,
            COALESCE(SUM(ss.discount), 0) AS totalDiscount,
            COALESCE(SUM(ss.amountIncurredDueTax), 0) AS totalAmountIncurredDueTax,
            COALESCE(SUM(ss.totalcost - ss.discount), 0) AS totalPayable,
            COALESCE(SUM(rr.amountRefunded), 0) AS totalRefunded
        FROM dboservices AS ss
        LEFT JOIN dbobillingrefundtable AS rr
            ON rr.serviceid = ss.serviceid
        WHERE ss.billingid = ? AND rr.isRefundCompleted = 0
        `
			: `
        SELECT 
            COALESCE(SUM(ss.totalcost), 0) AS totalCost, 
            COALESCE(SUM(ss.discount), 0) AS totalDiscount, 
            COALESCE(SUM(ss.amountIncurredDueTax), 0) AS totalAmountIncurredDueTax, 
            COALESCE(SUM(ss.totalcost - ss.discount), 0) AS totalPayable,
            COALESCE(SUM(
                CASE 
                    WHEN rr.isRefundApproved = 1 AND rr.isRefundCompleted = 1 AND rr.isRefundInitiated = 1 
                    THEN ss.totalcost 
                    ELSE 0 
                END
            ), 0) AS totalRefunded
        FROM dboservices AS ss
        LEFT JOIN dbobillingrefundtable AS rr 
            ON rr.serviceid = ss.serviceid 
        WHERE ss.billingid = ?
        `;

		const connection = await KnexConnection(tenantId);
		const result = await connection.raw(query, [billingid]);

		const row = result[0][0] || {};

		const totalCost = Number(row.totalCost || 0);
		const totalDiscount = Number(row.totalDiscount || 0);
		const totalAmountIncurredDueTax = Number(row.totalAmountIncurredDueTax || 0);
		const totalPayable = Number(row.totalPayable || 0);
		const totalRefunded = Number(row.totalRefunded || 0);

		const transactioncost = totalCost + totalRefunded;

		return {
			totalAmountIncurredDueTax,
			totalCost,
			totalDiscount,
			totalPayable,
			totalRefunded,
			transactioncost
		};
	}




	private async loadTestAscensionMultiple(tenantId: number, data: TestCart[], categoryTrackId: number, servicesBillingData: testServicesProvided, includeTax: number, taxValue: number, taxList: any) {
		if (data.length === 0) return false;
		let verifiedTestPricing = [];
		const { billingid, organizationId, clinicianId, insuranceId } = servicesBillingData;

		for (const item of data) {
			try {
				var { amountIncurredDueTax, discountedValue, serviceid, trackId, isOutsourced, outsourceid, ascensionId: prevAscensionId } = await this.verificationAndReformatingOfTestAndPrice(
					tenantId,
					item, categoryTrackId, { insuranceId, organizationId, clinicianId });

				let ascensionId = null;

				if (includeTax == 1) {
					amountIncurredDueTax = discountedValue * (taxValue / 100);
				}
				let loadingValues = { ...servicesBillingData, taxIncluded: includeTax, taxValue, amountIncurredDueTax, taxList }

				const totalCost = amountIncurredDueTax + discountedValue;

				serviceid = await this.insertTestBillingAsAServices(tenantId, discountedValue, trackId, isOutsourced, outsourceid, totalCost, loadingValues);
				if (typeof serviceid == "boolean" && !serviceid) {
					throw new Error('services not inserted');
				}

				if (typeof serviceid == 'number') {
					ascensionId = await this.AddtoTestAscenstion(tenantId, serviceid, billingid, trackId);
				}

				if (!ascensionId) throw new Error("test ascensionid not added");

				// this would have made the sample,processing states to be updated to collected
				// this.updateAscensionStates(isItCompleteFlow, ascensionId, employeeid, verifiedTestPricing, trackId, discountedValue);
			} catch (error: any) {
				throw error
			}
		}

		return verifiedTestPricing;
	}

	private async verificationAndReformatingOfServics(tenantId: number, item: servicesProvided) {
		const { keyid, discount } = item;
		const serviceItem = await new TiifuWorkingClass('additionalservices').findOne(tenantId, "keyid", keyid);
		const { servicePrice } = serviceItem
		return { discountedValue: servicePrice, discount: discount | 0 }
	}



	private updateAscensionStates(isItCompleteFlow: boolean, ascensionId: any, employeeid: number, verifiedTestPricing: any[], trackId: number, price: any) {
		try {
			if (isItCompleteFlow === false && ascensionId) {
				Billing.inCompleteFlowTestAscensionUpdate(employeeid, new Date(), ascensionId);
			}

			verifiedTestPricing.push({ testid: trackId, price });
		} catch (error: any) {
			throw error
		}
	}

	private static calculateTotalServicesValue(categoryTrackId: number, data: (TestCart | servicesProvided)[]) {
		if (data.length === 0) return 0;

		if (!(categoryTrackId && serviceCategory[categoryTrackId])) throw new Error(`categoryTrackId ${categoryTrackId} not found`);
		const amount = parseFloat(TiifuWorkingClass.reduceListInOF(data, 'discountedValue'));
		return amount;
	}

	private static calculateTotalDiscount(data: any[]) {
		return parseFloat(TiifuWorkingClass.reduceListInOF(data, 'discount') || 0)
	}


	public static calulateTotalPayableServices(
		categoryTrackId: number,
		data: any[],
		taxValue: number,
	): {
		amountIncurredDueTax: number,
		payable: number,
		totalServiceCost: number,
		totalDiscount: number,
		totalcost: number
	} {
		let totalServiceCost = 0;
		let totalcost = 0;
		let totalDiscount = 0;
		let payable = 0;
		let amountIncurredDueTax = 0;


		totalServiceCost = this.calculateTotalServicesValue(categoryTrackId, data);
		totalDiscount = this.calculateTotalDiscount(data);


		if (taxValue === 0) {
			payable = parseFloat((totalServiceCost - totalDiscount).toFixed(2));
			totalcost = parseFloat(totalServiceCost.toFixed(2));
		} else {
			amountIncurredDueTax = parseFloat(Billing.amountIncurredDueTaxes(totalServiceCost, taxValue).toFixed(2));
			totalcost = parseFloat((totalServiceCost + amountIncurredDueTax).toFixed(2));
			payable = parseFloat((totalServiceCost + amountIncurredDueTax - totalDiscount).toFixed(2));
		}

		return { amountIncurredDueTax, payable, totalServiceCost, totalDiscount, totalcost };
	}


	private static amountIncurredDueTaxes(totalServiceCost: any, taxValue: number) {
		return (totalServiceCost) * (taxValue / 100);
	}

	private async getTestOrganizationPriceValue(tenantId: number, organizationId: number, trackId: number, price: any) {
		try {
			const organization = new Organization(organizationId);
			const isValidOrganization = await organization.isProvidedOrganizationIdValid(tenantId, organizationId);

			if (!isValidOrganization)
				throw new Error(OperationsFailures.notFound);

			const { testList } = await new OrganizationalBilling(organizationId).getOrganizationalBilling(tenantId);

			if (Array.isArray(testList) && testList.length > 0) {
				const filterTest = testList.filter((a, index) => a['testid'] === trackId);

				if (filterTest.length == 0) throw new Error(OperationsFailures.notFound);

				price = filterTest[0]['discountedValue'];
			}
			return price;
		} catch (error: any) {
			throw error
		}
	}
	public static async updatePreviouslyBilledClientAfterRefundConcluded(
		tenantId: number,
		records: updateRefundCashRequestBodyType
	): Promise<boolean | void | undefined> {
		let trx: any;
		try {
			const { billingid, refundAmount, serviceid, employeeid, selectedPaymentMode } = records;
			if (![billingid, serviceid, employeeid, selectedPaymentMode].every(value => Number.isSafeInteger(value) && value > 0) ||
				typeof refundAmount !== 'number') return false;
			const refundCents = minorUnits(refundAmount);
			if (refundCents <= 0) return false;
			const connection = await KnexConnection(tenantId);
			trx = await connection.transaction();
			// Every balance and refund-state decision is made under the same locks
			// as the resulting financial writes. All callers share this boundary.
			const bill = await trx('billing').where({ billingid }).forUpdate().first();
			if (!bill) return false;
			if (Number(bill.islocked) === 1 || Number(bill.isWriteOff) === 1) return false;
			const finalizationGuard = new FinancialFinalizationGuard(tenantId, trx);
			await finalizationGuard.assertRecordMutable('billing', billingid);
			await finalizationGuard.assertDateOpen(Number(bill.branchid), bill.billedon);
			let { paid, payable, totalcost, totalrefunded, totalTransactionCost, discount, amountIncurredDueTax } = bill;
			const serviceInformation = await trx("dboservices as s")
				.join("dbobillingrefundtable as r", "s.serviceid", "r.serviceid")
				.select("s.totalpayable", "s.totalcost", "s.discount", "s.amountIncurredDueTax", "s.paidamount", "r.amountRefunded", 'r.isRefundApproved', 'r.isRefundCompleted', 'r.isRefundMatterClosed')
				.where("s.serviceid", serviceid)
				.where('s.billingid', billingid)
				.forUpdate()
				.first();
			if (!serviceInformation || Number(serviceInformation.isRefundApproved) !== 1 ||
				Number(serviceInformation.isRefundCompleted) === 1 || Number(serviceInformation.isRefundMatterClosed) === 1 ||
				refundCents > minorUnits(serviceInformation.paidamount) || refundCents > minorUnits(serviceInformation.totalpayable) ||
				refundCents > minorUnits(paid) || refundCents > minorUnits(payable)) return false;
			const mode = await trx('paymentmodes').where({ KeyID: selectedPaymentMode }).first();
			if (!mode) return false;

			if (serviceInformation) {
				const servicepayable = parseFloat(serviceInformation.totalpayable.toString()) - parseFloat(refundAmount.toString());
				const servicetotalcost = serviceInformation.totalcost;
				const servicediscount = serviceInformation.discount;
				const serviceAmountIncurredDueTax = serviceInformation.amountIncurredDueTax;
				const servicepaidAmount = parseFloat(serviceInformation.paidamount.toString()) - parseFloat(refundAmount.toString());
				const serviceTotalRefunded = parseFloat(serviceInformation.amountRefunded.toString()) + parseFloat(refundAmount.toString());
				const serviceoutstanding = servicepayable - servicepaidAmount;

				const newRefundableAmount = parseFloat(totalrefunded.toString()) + parseFloat(refundAmount.toString());
				const currentPayable = parseFloat(payable.toString()) - parseFloat(refundAmount.toString());
				const currentPaid = parseFloat(paid.toString()) - parseFloat(refundAmount.toString());
				const currentTotalCost = parseFloat(totalcost.toString())
				const currentDiscount = parseFloat(discount.toString())
				const currentAmountIncurredDueTax = parseFloat(amountIncurredDueTax.toString()) - parseFloat(serviceInformation.amountIncurredDueTax.toString());



				let newOutstandingAmount = 0;
				let newBalanceAmount = 0;

				if (currentPaid >= currentPayable) {
					newBalanceAmount = currentPaid - currentPayable;
				} else {
					newOutstandingAmount = currentPayable - currentPaid;
				}


				await trx.raw(q_update_Billing_Information, [
					currentPaid,
					currentPayable,
					newOutstandingAmount,
					currentDiscount,
					currentAmountIncurredDueTax,
					newBalanceAmount,
					newRefundableAmount,
					currentTotalCost,
					totalTransactionCost,
					billingid
				])


				await trx("dboservices")
					.update({
						isRefunded: 1,
						isLocked: 1,
						status: 'refunded',
						totalcost: servicetotalcost,
						paidamount: servicepaidAmount,
						totalpayable: servicepayable,
						outstanding: serviceoutstanding
					})
					.where({
						serviceid: serviceid
					})

				const updatedService = await trx("dboservices").where({ serviceid }).first();
				if (updatedService) {
					await applyDboservicesAfterUpdate(trx, updatedService, employeeid ? employeeid.toString() : undefined);
				}


				await trx("dbobillingrefundtable").update({
					isRefundCompleted: 1,
					isRefundMatterClosed: 1,
					refundedBy: employeeid,
					amountRefunded: serviceTotalRefunded,
				}).where({
					serviceid: serviceid
				});


				const historyInsert = await trx.raw(insertbillHistoryQuery, [billingid, selectedPaymentMode, refundAmount, employeeid, 'debit']);
				const historyResult = Array.isArray(historyInsert) ? historyInsert[0] : historyInsert;
				const refundHistoryId = Number(historyResult?.insertId);
				if (!refundHistoryId) throw new Error('Could not create refund history for accounting posting');

				await enqueueBillingRefund(
					tenantId,
					billingid,
					Number(refundAmount),
					Number(refundAmount),
					employeeid,
					trx,
					refundHistoryId,
					Number(selectedPaymentMode)
				);
				const trackingRepository = new CommissionTrackingRepository(tenantId, trx);
				const trackingRecords = await trackingRepository.findByServiceId(serviceid);
				const originalTracking = trackingRecords.find(tracking => tracking.status !== 'adjusted' && tracking.final_commission > 0);
				if (originalTracking) await trackingRepository.createAdjustment(originalTracking.id, refundAmount,
					`Service refund completed for service ${serviceid}`, 'refund');

				await trx.commit();

				return true;
			}

		}
		catch (err: any) {
			if (trx && !trx.isCompleted?.()) await trx.rollback().catch(() => undefined);
			throw err;
		} finally {
			if (trx && !trx.isCompleted()) await trx.rollback();
		}
	}




	private static async removeDuplicateServiceFromNewCart(tenantId: number, services: [], categoryTrackId: number, billingid: number) {
		let unique = [];

		for (let i = 0; i < services.length; i++) {
			const { id, testid, keyid } = services[i];
			const trackId = testid ? testid : id ? id : keyid;
			const hasAlreadyBeenBilled = await Services.hasServiceWithBillingIdAndTrackId(tenantId, billingid, categoryTrackId, trackId);

			if (!hasAlreadyBeenBilled) unique.push(services[i]);
		}
		return unique;
	}


	private static async validatePaymentModeId(tenantId: number, id: number): Promise<boolean> {
		const data: PrimeLimsTablepaymentmodes[] = await new TiifuWorkingClass("paymentmodes").findMany(tenantId, "KeyID", id);
		return Array.isArray(data) && data.length > 0;
	}

	public static async validateBillingRequestBody(
		tenantId: number,
		billingData: TBillingData
	): Promise<boolean | BillingValidationResult> {
		const {
			cart, servicesProvided, employeeid, paymentmode, samplingCenter, billingSource, paid, discount, patientid, payable, insuranceId, clinicianId
		} = billingData;

		if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
			return BillingValidationResult.INVALID_CART_OR_SERVICES;
		}

		if (cart.length === 0 && servicesProvided.length === 0) {
			return BillingValidationResult.EMPTY_CART_AND_SERVICES;
		}

		if (!employeeid || typeof employeeid !== "number") {
			return BillingValidationResult.INVALID_EMPLOYEE_ID;
		}

		if (!paymentmode || !(await this.validatePaymentModeId(
			tenantId,
			parseInt(paymentmode.toString(), 10)))) {
			return BillingValidationResult.INVALID_PAYMENT_MODE;
		}

		if (!samplingCenter) {
			return BillingValidationResult.MISSING_BRANCH_ID;
		}

		if (isNaN(payable) || isNaN(paid) || isNaN(discount)) {
			return BillingValidationResult.INVALID_PAYABLE_OR_PAID;
		}

		if (!patientid) {
			return BillingValidationResult.MISSING_PATIENT_ID;
		}

		if (!(await Registration.checkPatientIdExist(tenantId, patientid))) {
			return BillingValidationResult.INVALID_PATIENT_ID
		}

		if (!billingSource || !serviceCategory[billingSource]) {
			return BillingValidationResult.INVALID_MISSING_BILLING_SOURCE
		}


		if (billingSource && billingSource == 5 && !clinicianId) {
			return BillingValidationResult.INVALID_BILLING_SOURCE_MATCH
		}

		if (billingSource && billingSource == 4 && !insuranceId) {
			return BillingValidationResult.INVALID_BILLING_SOURCE_MATCH
		}

		function ensureNumericFields(data: TBillingData): boolean | BillingValidationResult {
			const fieldsToConvert = ["outstanding", "paid", "payable"];
			for (const field of fieldsToConvert) {
				const value = data[field];
				if (typeof value === "string") {
					const parsedValue = parseFloat(value);
					if (isNaN(parsedValue)) {
						return BillingValidationResult.INVALID_PAYABLE_OR_PAID;
					}
					data[field] = parsedValue;
				} else if (typeof value !== "number") {
					return BillingValidationResult.INVALID_PAYABLE_OR_PAID;
				}
			}
			return true;
		}

		const isNumericForNumerics = ensureNumericFields(billingData);

		if (isNumericForNumerics != true) {
			return isNumericForNumerics;
		}

		return true;
	}



	public async updatePreviousTransaction(
		tenantId: number,
		billingData: TBillingData,
		billingid: number): Promise<boolean | string> {
		const { employeeid, billingSource, type, clinicianId, organizationId, samplingCenter, insuranceId } = billingData;

		try {
			if (!billingid || typeof billingid !== "number") {
				throw new Error("billingid not provided or invalid");
			}

			const { cart, servicesProvided = [], isPackageUsed } = billingData;

			const validBillingIdProvided = await Billing.checkValidityOfBillingid(tenantId, billingid);
			if (!validBillingIdProvided) return OperationsFailures.notFound;

			const billdataValidation = await Billing.validateBillingRequestBody(tenantId, billingData);
			if (billdataValidation !== true) return billdataValidation;

			if (!Array.isArray(cart) || !Array.isArray(servicesProvided) || (cart.length <= 0 && servicesProvided.length <= 0)) {
				return OperationsFailures.invalidResponseBodyParams;
			}

			const parsedPayment = parseFloat(billingData.paid.toString());
			const currentPayment = parseFloat(parsedPayment.toFixed(2));

			let taxList = null;
			const { includeTax, taxValue } = await new ApplicationSettings().getAppBillSettings(tenantId);
			if (includeTax === 1) {
				taxList = JSON.stringify(await new TiifuWorkingClass("tax").findMany(tenantId, "apply", 'yes'));
			}

			let testCart = await Billing.removeDuplicateServiceFromNewCart(tenantId, cart as any, billingSource, billingid);
			let testServices = await Billing.removeDuplicateServiceFromNewCart(tenantId, servicesProvided as any, billingSource, billingid);

			if (testCart.length != cart.length || servicesProvided.length != testServices.length) {
				return OperationsFailures.someRequestedServicesAlreadyExistForThisTransaction
			}

			if (testCart.length === 0 && testServices.length === 0) {
				return OperationsFailures.allRequestedServicesAlreadyExistForThisTransaction;
			}

			const applyNightAdjustmentToServiceItems = await this.verificationOfServicesAndNightAdjustment(tenantId, testServices, 5, taxValue, isPackageUsed);
			const applyNightAdjustmentToTestCartItems = await this.verificationOfTestAndNightAdjustment(tenantId, testCart, billingSource, organizationId, insuranceId, clinicianId, taxValue, isPackageUsed);

			const processTestCart = await this.processTestCart(applyNightAdjustmentToTestCartItems as any, billingSource, organizationId, insuranceId, clinicianId, taxValue, billingid, employeeid, type, samplingCenter, taxList, includeTax == 1, isPackageUsed);

			const services = await this.processServicesCart(applyNightAdjustmentToServiceItems, billingid, billingData, taxList);

			let allEntries = [...processTestCart, ...services];

			if (allEntries.length == 0) return OperationsFailures.TestExist

			const billing_final_values = Billing.calculateBillingVariablesFinal(applyNightAdjustmentToServiceItems, applyNightAdjustmentToTestCartItems, taxValue, 5, billingSource, billingData.paid);

			const previousBilling = await this.getTransactionBillData(tenantId, billingid);
			if (previousBilling && Array.isArray(previousBilling) && previousBilling.length > 0) {
				const previousBillingData = previousBilling[0];
				const updatedBillingValues = this.calculateUpdatedBillingValues(previousBillingData, billing_final_values, billingData.paid);

				if (updatedBillingValues.totalPaid > updatedBillingValues.totalPayable) {
					return OperationsFailures.paymentExceedsPayableAmount;
				}

				const connection = await KnexConnection(tenantId);
				const trx = await connection.transaction()

				try {
					const loadAllServices = await this.mapAndInsertServices(tenantId, allEntries, billingid, trx);
					if (loadAllServices.length > 0) {
						throw new Error(billErrors.unableToLoadServices);
					}

					const uBillingValues = await trx("billing")
						.update({
							totalcost: updatedBillingValues.totalCost,
							payable: updatedBillingValues.totalPayable,
							paid: updatedBillingValues.totalPaid,
							discount: updatedBillingValues.totalDiscount,
							totalTransactionCost: updatedBillingValues.totalTotalTransactionCost,
							amountIncurredDueTax: updatedBillingValues.totalTax,
							outstanding: updatedBillingValues.currentTotalOutstanding,
							totalrefunded: previousBillingData.totalrefunded
						})
						.where({ billingid });


					// since we are upating then the categoryTrackId of the previous shoudld be the same as the current
					await trx('dboservices')
						.update({
							isNHIS: billingSource === 4 ? 1 : 0,
							isPHIS: billingSource === 3 ? 1 : 0,
							insuranceid: insuranceId || null,
							claimCode: null,
							organizationId,
							clinicianId,
							registrationType: type,
							branchid: samplingCenter,
							serviceCategory: serviceCategory[billingSource],
							categoryTrackId: billingSource,
						}).where({ billingid });

					if (uBillingValues == 1) {
						const hx = await trx.raw(insertbillHistoryQuery, [billingid, billingData.paymentmode, billingData.paid, billingData.employeeid, billingData.type]);
						await trx.commit();
						return rowAffected(hx[0]);
					}
				} catch (error: any) {
					console.log(error)
					await trx.rollback();
					throw error;
				}
			}

		} catch (error: any) {
			console.error("Error in updatePreviousTransaction:", error);
			throw error;
		}
	}

	private calculateUpdatedBillingValues(previousBillingData: any, billing_final_values: any, paidAmount: number) {
		const previousPaid = parseFloat(previousBillingData.paid);
		const previousRefunded = parseFloat(previousBillingData.totalrefunded);
		const previousDiscount = parseFloat(previousBillingData.discount);
		const previousOutstanding = parseFloat(previousBillingData.outstanding);
		const previousTotalTransactionCost = parseFloat(previousBillingData.totalTransactionCost);
		const previousTotalCost = parseFloat(previousBillingData.totalcost);
		const previousPayable = parseFloat(previousBillingData.payable);
		const previousTaxValue = parseFloat(previousBillingData.amountIncurredDueTax);

		const { payable: currentPayable, totalDiscount: currentDiscount, totalcost: currentTotalCost, amountIncurredDueTax: currentTax, outstanding: currentOutstanding } = billing_final_values;

		const totalPayable = previousPayable + currentPayable;
		const totalDiscount = previousDiscount + currentDiscount;
		const totalCost = previousTotalCost + currentTotalCost;
		const totalTax = previousTaxValue + currentTax;
		const totalOutstanding = previousOutstanding + currentOutstanding;
		const totalPaid = previousPaid + paidAmount;
		const totalTotalTransactionCost = (previousTotalTransactionCost + currentTotalCost) - previousRefunded;

		let currentTotalOutstanding = totalPaid < totalPayable ? totalPayable - totalPaid : 0;

		return {
			totalCost,
			totalPayable,
			totalPaid,
			totalDiscount,
			totalTotalTransactionCost,
			totalTax,
			currentTotalOutstanding
		};
	}

	private async multipleServicesAscensionProcess(tenantId: number, cart: TestCart[], insertionErrors: any[], servicesBillingData: {
		billingid: any;
		paymentmode: number;
		employeeid: number;
		serviceCategory: any;
		categoryTrackId: number;
		insuranceId: number,
		clinicianId: number;
		organizationId: number;
		type: string;
		branchid: number;
		taxValue: number,
		amountIncurredDueTax: number,
		taxIncluded: number,
		taxList: [] | string
	}, billingid: any, isItCompleteFlow: boolean, employeeid: number) {
		for (let i = 0; i < cart.length && insertionErrors.length == 0; i++) {
			let ascensionId = null;
			const { discountedValue, testid, id, organization } = cart[i];
			const correctTestid = testid ? testid : id;
			let outsourceid = null;
			let isOutsourced = false;
			if (organization && typeof organization == "object" && organization.hasOwnProperty('outsourceid')) {
				outsourceid = organization.outsourceid;
				isOutsourced = true;
			}
			const isServicesDullyInserted = await this.insertTestBillingAsAServices(tenantId, discountedValue, correctTestid, isOutsourced, outsourceid, 0, servicesBillingData);

			if (typeof isServicesDullyInserted == "boolean" && !isServicesDullyInserted) {
				insertionErrors.push(correctTestid);
				throw new Error('services not inserted');
			}

			if (typeof isServicesDullyInserted == 'number') {
				ascensionId = await this.AddtoTestAscenstion(tenantId, isServicesDullyInserted, billingid, correctTestid);
			}

			if (!ascensionId) throw new Error("test ascensionid not added");

			if (isItCompleteFlow === false && ascensionId) {
				Billing.inCompleteFlowTestAscensionUpdate(employeeid, new Date(), ascensionId);
			}
		}
	}

	private async cleanUpFailedbillingProcess(tenantId: number, billingid: number) {
		await this.deleteBillTransaction(tenantId, billingid);
		// const servicesClass = new Services(null);
		// servicesClass.deleteServicesAssociatedToBillingId(billingid);
		// await this.deleteBillingHistory(billingid);
		// const testAscensionClass = new TestAscension(null);
		// await testAscensionClass.deleteBilledAssociatedAscension(billingid);
	}

	private async loadMultipleServices(services: any[], billingid: number, tenantId: number, trx?: any) {
		const insertionErrors = [];
		const queryRunner = trx || await KnexConnection(tenantId);

		for (const item of services) {
			try {
				const [billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid, serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount, totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode, hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue, isPackageUsed, packageid] = item;
				const outcome = await queryRunner("dboservices").insert({
					billingid,
					trackId,
					cost,
					employeeid,
					serviceCategory,
					categoryTrackId,
					clinicianId,
					organizationId,
					registrationType,
					branchid,
					isoutsourced,
					outsourceid,
					serviceAddedOn,
					taxList,
					taxValue,
					amountIncurredDueTax,
					taxIncluded,
					discount,
					totalcost,
					totalpayable,
					isNHIS,
					isPHIS,
					insuranceid,
					claimCode,
					hasNightAdjustment,
					nightAdjustmentMode,
					nightAdjustmentValue,
					isPackageUsed,
					packageid
				});

				const serviceid =
					typeof outcome === "number"
						? outcome
						: Array.isArray(outcome)
							? outcome[0]
							: outcome?.serviceid;

				if (serviceid && typeof serviceid === "number") {
					await applyDboservicesAfterInsert(tenantId, queryRunner, {
						serviceid,
						billingid,
						trackId,
						cost,
						employeeid,
						serviceCategory,
						categoryTrackId,
						clinicianId,
						organizationId,
						registrationType,
						branchid,
						isoutsourced,
						outsourceid,
						serviceAddedOn,
						taxList,
						taxValue,
						amountIncurredDueTax,
						taxIncluded,
						discount,
						totalcost,
						totalpayable,
						isNHIS,
						isPHIS,
						insuranceid,
						claimCode,
						hasNightAdjustment,
						nightAdjustmentMode,
						nightAdjustmentValue,
						isPackageUsed,
						packageid,
					}, employeeid ? employeeid.toString() : undefined);
				}

				if (serviceid && item[5] != 5 && item[1]) {
					try {
						await this.AddtoTestAscenstion(tenantId, serviceid, billingid, item[1], queryRunner);
					} catch (err: any) {
						throw new Error(billErrors.unableToLoadTestAscension);
					}
				}
			} catch (err: any) {
				console.error("Error inserting service:", err);
				insertionErrors.push(err);
			}
		}

		return insertionErrors;
	}

	public async AddtoTestAscenstion(tenantId: number, serviceid: number, billingid: number, testid: number, trx?: any): Promise<boolean | number> {
		try {
			if (!billingid || !serviceid || !testid) return false;
			const queryRunner = trx || await KnexConnection(tenantId);
			const isInserted = await queryRunner.raw(AddtoTestAscenstionQuery, [testid, serviceid, billingid]);
			const ascensionid = isInserted?.insertId || isInserted?.[0]?.insertId || false;
			if (ascensionid && typeof ascensionid === "number") {
				await applyTestAscensionAfterInsertApprovalSettings(queryRunner, ascensionid);
			}
			return ascensionid;
		} catch (err: any) {
			return false;
		}
	}
}




