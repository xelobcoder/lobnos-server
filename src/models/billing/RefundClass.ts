/**
 * RefundClass.ts
 *
 * Handles all refund-related operations for billing and services, including initiation, verification,
 * witness management, approval, and cash-out processing. Integrates with billing, services, and user modules.
 * All methods are static and designed for transactional and role-based workflows.
 */
import { q_initiate_refund_first_witness } from './queries';
import { TiifuWorkingClass } from '../../database/TiifuWorkingClass';
import User from '../../LobnosAuth/user';
import { OperationsFailures } from '../operations/types';
import {
	hasAmountRefunded,
	q_get_a_service_refund_details,
	q_refund_get_all_refunds_status_completed,
	q_refund_get_all_refunds_status_completed_employee_specific,
	q_refund_get_all_refunds_status_pending,
	q_refunds_has_witness_before,
	q_service_refund_update_is_cashout,
	q_service_refundable_amount_exceeded,
	q_services_refund_has_withness_data,
	q_services_refund_status_change,
	q_services_refund_status_change_admin_approve,
	q_services_refund_status_is_approved,
	q_services_refund_status_is_completed,
} from '../services/queries';
import { PrimeLimsTablebilling, PrimeLimsTabledbobillingrefundtable, PrimeLimsTabledboservices } from '../../database/DatabaseTableSchema';
import { Billing } from '../../../obso/billing';
import { UpdatePreviousWitnessNoteBodyParams, updateRefundCashRequestBodyType, Witness } from '../../controllers/billing/sales/type';
import { CommissionTrackingRepository } from '../commissions/commission-configurations/repositories/CommissionTrackingRepository';
import { promisifyQuery, rowAffected, paginationQuery } from '../../hooks/helper';
import { Services } from '../services/services';
import { PrimeBillingEnterprise } from './multi/PrimeBillingEnterprise';
import KnexConnection from '../../database/KnexConnections';
import ApplicationSettings from '../application/appsettings/appset';


type dbReturned = PrimeLimsTabledbobillingrefundtable & PrimeLimsTabledboservices & PrimeLimsTablebilling[];

type witnessedType = { witness: string; name: string | null; message: string | null; employeeid: number };

type combinedType = dbReturned & witnessedType;

type withnessUpdatedType = combinedType & { canwitness: boolean; canEdit: boolean };

export class Refund {

	static async initiateRefundofServices(
		tenantId: number,
		employeeid: number,
		serviceid: number,
		purpose: string
	) {
		const result = await promisifyQuery(tenantId, q_initiate_refund_first_witness, [
			1,
			employeeid,
			employeeid,
			purpose,
			serviceid,
		]);
		return rowAffected(result);
	}


	private static async hasWitnessRefund(
		tenantId: number,
		trackId: number,
		employeeid: number
	): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_refunds_has_witness_before, [
			employeeid,
			employeeid,
			trackId,
		]);
		return result[0]['count'] > 0;
	}


	static async getAserviceRefundDetails(tenantId: number, serviceid: number, employeeid: number) {
		const result = await promisifyQuery(tenantId, q_get_a_service_refund_details, [serviceid]);

		if (result && Array.isArray(result) && result.length > 0) {
			const user = new User(null, null, null, null, null);
			const role = await user.getUserRole(employeeid, tenantId);
			if (role) {
				return await this.refundItemProcessed(tenantId, result, user, employeeid, role, 'completed');
			}
			return OperationsFailures.dontHaveAccessPermission
		}
		return null
	}



	public static async getAllRefundsWithPagination(
		tenantId: number,
		status: 'completed' | 'pending',
		count: number = 10,
		page: number = 1,
		orderDirection: 'ASC' | 'DESC' = 'ASC',
		employeeid: number
	) {
		const user = new User(null, null, null, null, null);
		const role = await user.getUserRole(employeeid, tenantId);
		const stringRole = (role || '').toString().toLowerCase();
		const isAdminRole = ['admin', 'superadmin', 'super-admin', 'manager', 'crm', 'accountant', 'customer service representative'].includes(stringRole);

		let values: any[] = [];
		let query = '';
		if (!isAdminRole && status === 'completed') {
			query = q_refund_get_all_refunds_status_completed_employee_specific;
			values.push(employeeid);
			values.push(employeeid);
		} else {
			query = status === 'completed'
				? q_refund_get_all_refunds_status_completed
				: q_refund_get_all_refunds_status_pending;
		}

		const safeOrder = orderDirection === 'DESC' ? 'DESC' : 'ASC';
		query = query.replace('{orderDirection}', safeOrder);

		let result: dbReturned[] | combinedType[] = await paginationQuery({ count, page }, query, values, tenantId);

		let outcome = await Refund.refundItemProcessed(tenantId, result, user, employeeid, role || '', status);
		return outcome;
	}

	private static async refundItemProcessed(tenantId: number, result: any[], user: User, employeeid: number, role: string, status: string) {
		if (result.length > 0) {
			result = await Promise.all(
				result.map(async (item: any) => {
					return await Refund.serviceDifferentiatedToWithness(tenantId, item, user, employeeid, role, status);
				})
			);
		}

		const accessoriesBillingInformation = new Billing(0);
		return await Promise.all(Refund.prepareServiceItemForResponseBulk(tenantId, result, accessoriesBillingInformation, role));
	}


	private static prepareServiceItemForResponseBulk(tenantId: number, result: any[], accessoriesBillingInformation: Billing, role: string): Promise<any>[] {
		return result.map(async (item: any) => {
			const responseData = await Refund.prepareResponseData(tenantId, accessoriesBillingInformation, item);

			if (role !== 'admin') {
				return responseData;
			}
			return { ...responseData, isRefundCompleted: item.isRefundCompleted };
		});
	}


	private static async prepareResponseData(tenantId: number, accessoriesBillingInformation: Billing, item: any) {
		let serviceName: string = '';
		const accessories = await accessoriesBillingInformation.diffentiateBilledToIndividualServices(tenantId, [item]);
		if (accessories.length > 0) {
			serviceName = accessories[0]['name'];
		}

		const responseData = {
			refundid: item.refundid,
			serviceid: item.serviceid,
			serviceCategory: item.serviceCategory,
			witnesses: item.witnesses,
			cost: item.cost,
			amountIncurredDueTax: item.amountIncurredDueTax,
			billedby: item.billedby,
			refundedby: item.refundedBy || null,
			approvalDate: item.approvalDate || null,
			serviceName,
			amountRefunded: item.amountRefunded || null,
			billingid: item.billingid,
			canwitness: item.canwitness,
			canEdit: item.canEdit,
			isRefundApproved: item.isRefundApproved,
			isRefundCompleted: item.isRefundCompleted
		};
		return responseData;
	}


	private static async serviceDifferentiatedToWithness(tenantId: number, item: any, user: User, employeeid: number, role: string, status: string) {
		let witnesses: witnessedType[] = await Refund.getWithnessFromServiceItem(tenantId, item, user, employeeid);
		item.canEdit = false;
		item.canwitness = false;
		if (role !== 'admin') {
			witnesses = Refund.processNonAdminServiceItem(witnesses, employeeid, status, item);
		}

		return { ...item, witnesses };
	}


	private static processNonAdminServiceItem(witnesses: witnessedType[], employeeid: number, status: string, item: any) {
		if (witnesses.length > 0) {
			const hasWitnessBefore = witnesses.map((_witness) => _witness.employeeid).includes(parseInt(employeeid.toString(), 10));

			const moreWithnessNeeded = witnesses.filter((_witness: witnessedType) => {
				return _witness.employeeid == null || _witness.employeeid === 0;
			});

			if (status === "pending") {
				if (moreWithnessNeeded.length > 0) {
					if (!hasWitnessBefore) {
						item.canwitness = true;
						witnesses = [];
						item.canEdit = false;
					} else {
						witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString()));
						item.canwitness = false;
						item.canEdit = true;
					}
				} else {
					item.canwitness = false;
					item.canEdit = false;
					if (hasWitnessBefore) {
						witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString()));
					} else {
						witnesses = [];
					}
				}
			} else {
				witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString())) || [];
			}
		}
		return witnesses;
	}


	private static async getWithnessFromServiceItem(tenantId: number, item: any, user: User, employeeid: number) {
		const witnessId = (item.firstWitness && Number(item.firstWitness) > 0)
			? Number(item.firstWitness)
			: (item.initiatedBy && Number(item.initiatedBy) > 0) ? Number(item.initiatedBy) : 0;
		let witnesses: witnessedType[] = [];

		if (witnessId > 0) {
			const userData = await user.getUserDataById(witnessId, tenantId);
			if (userData && userData.length > 0) {
				const { username, employeeid: empId } = userData[0];
				witnesses.push({ witness: 'witness', name: username, message: `${item.firstWitnessPurpose || item.rejectionmessage || ''}`, employeeid: empId });
			} else {
				witnesses.push({ witness: 'witness', name: 'not found', message: `${item.firstWitnessPurpose || item.rejectionmessage || ''}`, employeeid: witnessId });
			}
		} else {
			witnesses.push({ witness: 'witness', name: null, message: `${item.firstWitnessPurpose || ''}`, employeeid: 0 });
		}
		return witnesses;
	}

	public static async updateWitnessNote(data: UpdatePreviousWitnessNoteBodyParams) {
		const { refundid, witnesses } = data;
	}
	private static async getAllRefundInitiated(tenantId: number) {
		return await promisifyQuery(tenantId, q_refund_get_all_refunds_status_pending);
	}

	private static async getAllRefundCompleted(tenantId: number) {
		return await promisifyQuery(tenantId, q_refund_get_all_refunds_status_completed);
	}

	public static async getservicesRefundWithness(tenantId: number, serviceid: number) {
		return await promisifyQuery(tenantId, q_services_refund_has_withness_data, [serviceid]);
	}

	public static async isServiceRefundedOut(tenantId: number, serviceid: number): Promise<boolean | null> {
		const record: PrimeLimsTabledbobillingrefundtable = await new TiifuWorkingClass("dbobillingrefundtable").findOne(tenantId, "serviceid", serviceid);
		if (!record) return null;
		const { isRefundCompleted } = record;
		return isRefundCompleted == 1;
	}

	private static async withnessStatus(tenantId: number, serviceid: number) {
		const refundServiceInformation = await new TiifuWorkingClass(
			'dbobillingrefundtable'
		).findOne(tenantId, 'serviceid', serviceid);

		if (!refundServiceInformation) return 'witness';
		const { firstWitness, initiatedBy } = refundServiceInformation;

		if ((!firstWitness || Number(firstWitness) === 0) && (!initiatedBy || Number(initiatedBy) === 0)) return 'witness';
		return 'allWitnessesAssigned';
	}


	private static async updateWitnessOfRefund(tenantId: number, data: {
		serviceid: number;
		employeeid: number;
		witnesStatus: string;
		reason: string;
	}): Promise<boolean | string> {
		const { serviceid, employeeid, witnesStatus, reason } = data;
		const hasWitnessBefore = await this.hasWitnessRefund(tenantId, serviceid, employeeid)
		if (hasWitnessBefore) return OperationsFailures.resourceExist
		if (witnesStatus) return await this.updateWitnessStatus(tenantId, witnesStatus, serviceid, employeeid, reason)
		return false;
	}

	static async updateWitnessStatus(
		tenantId: number,
		witness: string,
		serviceid: number,
		employeeid: number,
		reason: string
	): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_services_refund_status_change, [employeeid, reason, serviceid]);
		return rowAffected(result);
	}

	public static async requestForServicesAsRefundWitness(
		tenantId: number,
		employeeid: number,
		serviceid: number,
		reason: string,
		trx?: any
	): Promise<boolean | string | undefined> {
		try {
			if (
				!serviceid ||
				!employeeid ||
				typeof serviceid !== 'number' ||
				typeof employeeid !== 'number'
			) {
				return false;
			}

			const role = await new User().getUserRole(employeeid, tenantId);
			if (!role) return false;

			const withnessStatus = await this.withnessStatus(tenantId, serviceid);
			const stringifyRole = role.toString().trim();

			if (withnessStatus === 'allWitnessesAssigned') return OperationsFailures.allWitnessesAssigned;

			const witnessResult = await this.updateWitnessOfRefund(
				tenantId, {
				serviceid,
				employeeid,
				witnesStatus: withnessStatus as string,
				reason,
			});

			if (typeof witnessResult === 'string') return witnessResult;

			await promisifyQuery(
				tenantId,
				`UPDATE dbobillingrefundtable SET isRefundInitiated = 1, initiatedBy = ? WHERE serviceid = ?`,
				[employeeid, serviceid]
			);

			const applicationsettings = await new ApplicationSettings()
				.getAllAppSettings(tenantId);

			const allowManagerToRefund = applicationsettings?.allowManagerToRefund || 0;

			if (
				['admin', 'superadmin', 'super-admin'].includes(stringifyRole) ||
				(stringifyRole === 'manager' && parseInt(allowManagerToRefund.toString(), 10) === 1)
			) {
				const result = await promisifyQuery(tenantId, q_services_refund_status_change_admin_approve, [1, new Date(), employeeid, serviceid]);
				return rowAffected(result);
			}

			return true;
		} catch (error: any) {
			return error.message;
		}
	}

	async isAmountRefundedOut(tenantId: number, serviceid: number): Promise<boolean | null> {
		const result = await promisifyQuery(tenantId, hasAmountRefunded, [serviceid]);
		if (!result || !Array.isArray(result)) return null;
		return result[0].count > 0;
	}

	static async approveRequestedRefund(tenantId: number, serviceid: number, employeeid: number, isApprove: number) {
		try {

			const billingData: PrimeLimsTabledboservices = await new TiifuWorkingClass("dboservices").findOne(tenantId, "serviceid", serviceid);
			if (!billingData) return OperationsFailures.notFound;
			const isbillingLocked = await PrimeBillingEnterprise.isBillingLocked(tenantId, billingData.billingid);
			if (isbillingLocked) return OperationsFailures.billingLocked;
			const isRefundCompleted = await this.isServiceRefundConcluded(tenantId, serviceid);
			if (isRefundCompleted) return OperationsFailures.refundAlreadyConcluded;
			const approvalDate = new Date();
			const result = await promisifyQuery(tenantId, q_services_refund_status_change_admin_approve, [isApprove, approvalDate, employeeid, serviceid]);
			return rowAffected(result);
		} catch (err) {
			throw err;
		}
	}

	static async isServiceRefundApproved(tenantId: number, serviceid: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_services_refund_status_is_approved, [serviceid]);
		return result.length > 0;
	}

	static async isServiceRefundConcluded(tenantId: number, serviceid: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_services_refund_status_is_completed, [serviceid]);
		return result.length > 0;
	}

	private static async amountRefundableExceeded(tenantId: number, serviceId: number): Promise<boolean | null> {
		const result: (PrimeLimsTabledboservices & PrimeLimsTabledbobillingrefundtable)[] = await promisifyQuery(tenantId, q_service_refundable_amount_exceeded, [serviceId]);
		if (!result || !Array.isArray(result)) return null;
		const { amountRefunded, paidamount } = result[0];
		const canAmountSillBeRefunded = parseFloat(paidamount.toString()) - parseFloat(amountRefunded.toString());
		if (canAmountSillBeRefunded <= 0) return true;
		return false;
	}

	static async issueOutCashOutOfRefund(tenantId: number, records: updateRefundCashRequestBodyType) {
		const { serviceid, employeeid, refundAmount, selectedPaymentMode, billingid } = records;
		try {
			const isApproved = await this.isServiceRefundApproved(tenantId, serviceid);
			if (!isApproved) return OperationsFailures.notapproved;

			const isRefundAmmountExceeded = await this.amountRefundableExceeded(tenantId, serviceid);
			if (isRefundAmmountExceeded === null) return OperationsFailures.notFound;
			if (isRefundAmmountExceeded === true) return OperationsFailures.refundAmmountExceeded;

			if (isRefundAmmountExceeded === false) {
				const refundResult = await Billing.updatePreviouslyBilledClientAfterRefundConcluded(tenantId, records);
				if (refundResult) {
					const trackingRepository = new CommissionTrackingRepository(tenantId);
					const trackingRecords = await trackingRepository.findByServiceId(serviceid);
					const originalTracking = trackingRecords.find((tracking) =>
						tracking.status !== 'adjusted' && tracking.final_commission > 0
					);

					if (originalTracking) {
						await trackingRepository.createAdjustment(
							originalTracking.id,
							Number(refundAmount),
							`Service refund completed for service ${serviceid}`,
							'refund'
						);
					}
				}

				return refundResult;
			}

			return OperationsFailures.unauthorized;
		} catch (err) {
			await promisifyQuery(tenantId, q_service_refund_update_is_cashout, [null, 0, serviceid]);
		}
	}

	static async calculateServiceRefundableAmount(tenantId: number, serviceid: number) {
		if (!serviceid) return undefined;
		const serviceData: (PrimeLimsTabledboservices & PrimeLimsTabledbobillingrefundtable)[] =
			await promisifyQuery(tenantId, q_service_refundable_amount_exceeded, [serviceid])
		const { paidamount, amountRefunded } = serviceData[0]
		const refundableAmount = parseFloat(paidamount.toString()) - parseFloat(amountRefunded.toString());
		return refundableAmount;
	}


	static async refundVerification(tenantId: number, serviceid: number, billingid: number): Promise<{ refundableAmount: number; message?: string } | string | boolean> {
		const isBillingIdValid = await Billing.checkValidityOfBillingid(tenantId, billingid);
		if (!isBillingIdValid) return OperationsFailures.notFound;

		const isRefundAmmountExceeded = await this.amountRefundableExceeded(tenantId, serviceid);
		if (isRefundAmmountExceeded) return isRefundAmmountExceeded;
		if (isRefundAmmountExceeded == null) return OperationsFailures.notFound;


		const transactionData = await new Billing(0).getTransactionBillData(tenantId, billingid);
		if (transactionData && Array.isArray(transactionData) && transactionData.length > 0) {
			const refundableAmount = await this.calculateServiceRefundableAmount(tenantId, serviceid);
			if (!refundableAmount) return OperationsFailures.notFound;
			if (refundableAmount <= 0) {
				return {
					refundableAmount: 0,
					message: 'Amount paid is less than refundable Amount '
				}
			}
			return { refundableAmount }
		}
		return OperationsFailures.notFound;
	}

	static async refundAllItemsOfTransaction(tenantId: number, billingid: number, employeeid: number, selectedPaymentMode: number): Promise<boolean | string | void> {
		const validity = await Billing.checkValidityOfBillingid(tenantId, billingid);
		if (!validity) return OperationsFailures.unfoundID;

		const serviceList: PrimeLimsTabledboservices[] = await Services.findAllServicesAssociatedWithBillingId(tenantId, billingid);

		const updatedValues = await Promise.all(serviceList.map(async (item: PrimeLimsTabledboservices) => {
			const { serviceid } = item;
			const initiate = await this.initiateRefundofServices(tenantId, employeeid, serviceid, 'Admin Refund of all transaction services');
			if (!initiate) return false;

			const updateWithness = await this.approveRequestedRefund(tenantId, serviceid, employeeid, 1);
			if (!updateWithness) throw new Error("Witness Not Found");

			const isServiceAlreadyRefunded = await this.isServiceRefundedOut(tenantId, serviceid);

			if (isServiceAlreadyRefunded == true) return true;
			if (isServiceAlreadyRefunded == null) return false;

			if (isServiceAlreadyRefunded == false) {
				const refundableAmount = await this.refundVerification(tenantId, serviceid, billingid);
				if (!refundableAmount || typeof refundableAmount !== "object" || !refundableAmount.refundableAmount) return false;

				const amountToRefund = refundableAmount.refundableAmount;
				const issueOutCash = await this.issueOutCashOutOfRefund(tenantId, {
					selectedPaymentMode,
					serviceid,
					employeeid,
					billingid,
					refundAmount: amountToRefund,
					trackId: 0,
					name: '',
					cost: 0
				});
				return issueOutCash;
			}
		}));

		const isAllRefunded = updatedValues.some((item) => item !== false);
		// if all is refunded , we lock billing table and update islockedstatus
		if (isAllRefunded) {
			const lockBilling = await PrimeBillingEnterprise.lockBillingRecord(tenantId, billingid, 'voided');
			if (!lockBilling) return OperationsFailures.notFound;
			return true;
		}
	}
}




