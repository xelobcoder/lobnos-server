import KnexConnection from "../../../database/KnexConnections";
import ApplicationSettings from "../../application/appsettings/appset";
import { ApplicationSettingsData, AppSetting, billingsettings } from "../../application/appsettings/Type";
import BillingStrategy from "../../clincians/billingstrategy";
import { ReferralCodingRepo } from "../../referral/repositories/ReferralCodingRepo";
import Services from "../../services/services";
import { EntityType } from "./billing_shared_types";
import { SalesSessionRepo } from "../repositories/SalesSessionRepo";
import { BillingModuleCodes } from "./billingTypes";

export class PrimeBillingEnterprise {
	protected tenantId: number;
	protected connection: any;

	constructor(tenantId: number) {
		this.tenantId = tenantId;
		this.connection = KnexConnection(this.tenantId);
	}


	static comparePaidAmountToServicesAndCart(
		paidAmount: number,
		services: { paidamount?: number }[] = [],
		cart: { paidamount?: number }[] = []
	) {
		const totalServicePaid = services.reduce((sum, s) => sum + (typeof s.paidamount === 'number' ? s.paidamount : 0), 0);
		const totalCartPaid = cart.reduce((sum, c) => sum + (typeof c.paidamount === 'number' ? c.paidamount : 0), 0);
		const totalPaid = totalServicePaid + totalCartPaid;
		const diff = Number((paidAmount - totalPaid).toFixed(2));
		return {
			equal: Math.abs(diff) < 0.01,
			totalServicePaid,
			totalCartPaid,
			totalPaid,
			diff
		};
	}

	async getAppSettings(): Promise<ApplicationSettingsData | null> {
		return await new ApplicationSettings().getAllAppSettings(this.tenantId);
	}

	async getAppBillSettings(): Promise<Partial<AppSetting>> {
		return await new ApplicationSettings().getAppBillSettings(this.tenantId);
	}

	async getCustomerOutstandingDebt(patientId: number): Promise<number> {
		const conn = await KnexConnection(this.tenantId);
		const result = await conn("billing").where("patientid", patientId).sum("outstanding as totalOutstanding").first();
		return result?.totalOutstanding || 0;
	}

	async checkIfCurrentLastInCorrectionOrder(billingid: number): Promise<boolean> {
		if (!billingid) return false;
		const conn = await KnexConnection(this.tenantId);
		const result = await conn("billing")
			.where("relatedBillingId", billingid)
			.select("billingid")
			.orderBy("billingid", "desc")
			.first();
		if (!result) return true;
		return result.billingid === billingid
	}

	async hasOutstandingDebt(patientId: number, ispricingcheckout: boolean): Promise<boolean> {
		if (ispricingcheckout) return false;
		const outstandingAmount = this.getCustomerOutstandingDebt(patientId);
		return parseFloat(outstandingAmount.toString()) > 0;
	}

	async validateActiveSession(branchid: number, errorMsg = 'No active session') {
		const sessionRepo = new SalesSessionRepo(this.tenantId);
		const today = (new Date() as unknown) as string;
		const sessionExists = await sessionRepo.hasActiveSessionForDate(today, branchid);
		if (!sessionExists) return errorMsg;
		return null;
	}
	async previousBillingSummary(billingId: number) {
		const conn = await KnexConnection(this.tenantId);
		const result = await conn("billing")
			.where("billingid", billingId)
			.select("*")
			.first();
		return result || null;
	}

	async getReferralByCode(referalCode: string) {
		return await new ReferralCodingRepo(this.tenantId).findByCode(referalCode);
	}

	async getAllServices() {
		return await new Services(0).getAllservices(this.tenantId);
	}

	async getBillingHandler(entityType: EntityType, entityId: any) {
		return await new BillingStrategy().getProvidentialBillingHandler(this.tenantId, entityType, entityId, true);
	}
	async applyDiscountsToTests(tests: any[], type: 'test' | 'services') {
		return tests.map(test => {
			if (!test.discountedValue || test.discountedValue === 0) return test;
			const discount = test.discount || 0;
			const base = type === 'test' ? test.actualPrice : (test.servicePrice ?? 0);
			const discountedValue = base - discount;
			return { ...test, discountedValue, discount };
		});
	}

	static applyPromoToItems<T extends { discountedValue?: number; promoDiscount?: number; discount?: number; totalpayable?: number }>(items: T[], promo: { type: 'percentage' | 'flat', value: number }): T[] {
		if (!Array.isArray(items) || !promo || !promo.value || promo.value <= 0) return items;
		if (items.length === 0) return items;
		if (promo.type === 'percentage') {
			return items.map(item => {
				if (!item.discountedValue || item.discountedValue === 0) {
					return { ...item };
				}
				const base = item.discountedValue || 0;
				const share = Number(((base * promo.value) / 100).toFixed(2));
				const totalpayable = Number((base - share).toFixed(2));
				return {
					...item,
					promoDiscount: share,
					totalcost: base,
					discountedValue: totalpayable,
					totalpayable,
					discount: Number(((item.discount || 0) + share).toFixed(2))
				};
			});
		} else if (promo.type === 'flat') {
			const validItems = items.filter(item => item.discountedValue && item.discountedValue !== 0);
			const totalPromoDiscount = Number(promo.value);
			const perItem = validItems.length > 0 ? Number((totalPromoDiscount / validItems.length).toFixed(2)) : 0;
			let distributed = 0;
			return items.map((item, idx) => {
				if (!item.discountedValue || item.discountedValue === 0) {
					return { ...item };
				}
				const base = item.discountedValue || 0;
				const validIdx = validItems.indexOf(item);
				const share = validIdx === validItems.length - 1
					? Number((totalPromoDiscount - distributed).toFixed(2))
					: perItem;
				distributed += share;
				const totalpayable = Number((base - share).toFixed(2));
				return {
					...item,
					promoDiscount: share,
					discountedValue: totalpayable,
					totalpayable,
					totalcost: base,
					discount: Number(((item.discount || 0) + share).toFixed(2))
				};
			});
		}
		return items;
	}
	static calculatePromoDiscount(subtotal: number, promoDetails: { discount_type: 'percentage' | 'flat', discount_value: number }): number {
		if (!promoDetails || !promoDetails.discount_value || promoDetails.discount_value <= 0) return 0;
		if (promoDetails.discount_type === 'percentage') {
			return Number(((subtotal * promoDetails.discount_value) / 100).toFixed(2));
		} else if (promoDetails.discount_type === 'flat') {
			return Number(promoDetails.discount_value);
		}
		return 0;
	}

	static convertTo24Hour(hour: number, period?: string): number {
		if (typeof hour !== 'number') return 0;
		if (hour > 23) return hour % 24;
		if (period?.toLowerCase() === 'pm') return hour === 12 ? 12 : hour + 12;
		else if (period?.toLowerCase() === 'am') return hour === 12 ? 0 : hour;
		return hour;
	}

	static isNightTime(billingsettings: billingsettings): boolean {
		const { startTime, endTime } = billingsettings;
		const now = new Date();
		const currentHour = now.getHours();
		const [startHour] = (startTime || "0:00").split(":").map(Number);
		const [endHour] = (endTime || "0:00").split(":").map(Number);
		const sHour = startHour % 24;
		const eHour = endHour % 24;
		if (sHour > eHour) return currentHour >= sHour || currentHour < eHour;
		return currentHour >= sHour && currentHour < eHour;
	}

	static applyNightAdjustmentsToTests<T extends { discountedValue?: number; servicePrice?: number; price?: number; discount?: number }>(tests: T[], billingsettings: any, type: 'services' | 'test'): T[] {
		if (Array.isArray(tests) && billingsettings && billingsettings.hasNightAdjustment) {
			const { nightAdjustmentValue, nightAdjustmentMode } = billingsettings;
			const isNight = this.isNightTime(billingsettings);
			return tests.map(test => {
				const base = Number(test.discountedValue || 0);
				// const discount = Number(test.discount || 0);
				const discountedBase = base;
				if (!isNight) {
					return {
						...test,
						discountedValue: discountedBase,
						isNightTime: false
					};
				}
				let adjustedValue = discountedBase;
				if (nightAdjustmentMode === "percentage") {
					adjustedValue = Number(((discountedBase ? discountedBase : 0 )* (Number(nightAdjustmentValue) / 100)).toFixed(2));
					adjustedValue += discountedBase;
				} else if (nightAdjustmentMode === "absolute") {
					adjustedValue = Number(((discountedBase ? discountedBase : 0 )+ Number(nightAdjustmentValue)).toFixed(2));
				}
				return {
					...test,
					discountedValue: adjustedValue,
					isNightTime: true,
					totalpayable: adjustedValue,
					totalcost: adjustedValue
				};
			});
		} else {
			return tests;
		}
	}


	static applyDiscountsToTests<T extends { servicePrice?: number; discountedValue?: number; discount?: number; price?: number }>(tests: T[]): T[] {
		try {
			return tests.map(test => {
				if (!test.discountedValue || test.discountedValue === 0) return { ...test, discountedValue: 0, discount: 0, userAdjustedValue: 0 };
				const { userAdjustmentType, userAdjustedValue } = test as any;

				const parsedBase = parseFloat(test.discountedValue.toString());
				const parsedUserAdjustedValue = userAdjustedValue ? parseFloat(userAdjustedValue.toString()) : 0;


				if (userAdjustmentType == "surcharge" && userAdjustedValue && parsedUserAdjustedValue > 0 && parsedBase && parsedBase > 0) {
					const adjustedValue = parsedBase + parsedUserAdjustedValue
					return { ...test, discountedValue: adjustedValue, userAdjustedValue };
				}

				if (userAdjustmentType == "discount" && userAdjustedValue && parsedBase && parsedBase > 0 && parsedUserAdjustedValue > 0) {
					const base = test.discountedValue;
					const discountedValue = Math.max(0, parsedBase - parsedUserAdjustedValue)
					return { ...test, discountedValue, discount: userAdjustedValue, userAdjustedValue };
				}

				return { ...test, discountedValue: test.discountedValue, discount: test.discount || 0, userAdjustedValue: 0, userAdjustmentType: null };
			});
		} catch (error) {
			console.error("Error applying discounts to tests:", error);
			return tests;
		}
	}

	static applyTaxToTests<T extends { discountedValue?: number; servicePrice?: number; price?: number; cost?: number; totalpayable?: number; totalcost?: number; discount?: number; promoDiscount?: number; nightAdjustmentValue?: number; nightAdjustmentMode?: string; isNightTime?: boolean }>(tests: T[], taxValue: number): T[] {
		if (!Array.isArray(tests)) return tests;
		if (!taxValue || taxValue <= 0) {
			return tests.map(test => {
				const totalpayable = test.discountedValue
				return {
					...test,
					amountIncurredDueTax: 0,
					totalpayable,
					totalcost: test.discountedValue || 0
				};
			});
		}
		return tests.map(test => {
			const preDiscountValue = Number(test.discountedValue);
			const parsedTaxValue = Number(taxValue);
			const taxAmount = parseFloat(((preDiscountValue * (parsedTaxValue / 100))).toFixed(2));
			const totalcost = Number((preDiscountValue + taxAmount).toFixed(2));
			return {
				...test,
				amountIncurredDueTax: taxAmount,
				totalcost,
				totalpayable: totalcost,
				discountedValue: test.discountedValue
			};
		});
	}
	static calculatePackageConcessionDiscountedValue(price: number, concessionMode: string, concessionValue: string | number): number {
		if (!price || !concessionMode || !concessionValue) return price;
		const value = typeof concessionValue === 'string' ? parseFloat(concessionValue) : concessionValue;
		if (concessionMode === 'absolute') {
			return Math.max(0, price - value);
		} else if (concessionMode === 'percentage') {
			return Math.max(0, price - (price * value / 100));
		}
		return price;
	}

	static validateBillingInput({
		patientId,
		branchid,
		billingSource,
		errorCodes,
		pricingcheckout,
		nhismembershipid,
		claimscheckcode
	}: {
		patientId: number | undefined;
		branchid: number | undefined;
		billingSource: number | undefined;
		cart: any[] | undefined;
		servicesList: any[] | undefined;
		errorCodes: {
			NO_PATIENT_ID: string;
			NO_BRANCH_ID: string;
			NO_BILLING_SOURCE: string;
			CART_AND_SERVICES_EMPTY: string;
		};
		pricingcheckout?: boolean;
		nhismembershipid?: string | number;
		claimscheckcode?: string | number;
	}) {
		if (!patientId && !pricingcheckout) return errorCodes.NO_PATIENT_ID;
		if (branchid === undefined || branchid === null) return errorCodes.NO_BRANCH_ID;
		if (billingSource === undefined || billingSource === null) return errorCodes.NO_BILLING_SOURCE;
		if (billingSource === 4 && (!nhismembershipid || !claimscheckcode)) {
			return BillingModuleCodes.MODULE_MISSING_NHIS_INFO;
		}
		return null;
	}
	static reformatServicesList(servicesList: any[], isNightTime: boolean, taxList: string, taxValue: number): any[] {
		if (!Array.isArray(servicesList)) return [];
		return servicesList.map(service => {
			const base = {
				...service,
				id: service.serviceid,
				name: service.serviceName,
				price: service.servicePrice,
				originalPrice: service.servicePrice,
				totalpayable: service.servicePrice,
				totalcost: service.servicePrice,
				discountedValue: service.servicePrice,
				actualPrice: service.servicePrice,
				concessionMode: "absolute",
				concessionValue: 0,
				discount: 0,
				isoutsourced: 0,
				amountIncurredDueTax: 0,
				isNightTime: isNightTime,
				trackId: service.keyid,
				taxList,
				taxValue
			};
			if (isNightTime && service.billingsettings && service.billingsettings.hasNightAdjustment) {
				return {
					...base,
					hasNightAdjustment: isNightTime,
					nightAdjustmentValue: Number(service.billingsettings.nightAdjustmentValue),
					nightAdjustmentMode: service.billingsettings.nightAdjustmentMode,
					nightAdjustmentStartTime: service.billingsettings.startTime,
					nightAdjustmentEndTime: service.billingsettings.endTime
				};
			} else {
				return {
					...base,
					hasNightAdjustment: false
				};
			}
		});
	}

	static calculateBillingTotals({
		usedPackage,
		recalculatedPackageList,
		recalculatedCart,
		recalculatedServicesList
	}: {
		usedPackage: boolean;
		recalculatedPackageList: any[];
		recalculatedCart: any[];
		recalculatedServicesList: any[];
	}) {

		if (!Array.isArray(recalculatedCart) && !Array.isArray(recalculatedServicesList)) {
			return { subtotal: 0, totaldiscount: 0, totalAmountIncurredDueTax: 0, totalServiceAmount: 0, totalpayable: 0 };
		}
		let subtotal = 0, totaldiscount = 0, totalAmountIncurredDueTax = 0, totalServiceAmount = 0, totalpayable = 0;
		let totalsurcharge = 0;
		if (usedPackage) {
			recalculatedPackageList.forEach(item => {
				subtotal += item.discountedValue;
				totaldiscount += item.discount;
				totalpayable += item.totalpayable;
			});
		} else {
			recalculatedCart.forEach(item => {
				if (item.userAdjustmentType === "surcharge" && item.userAdjustedValue && parseFloat(item.userAdjustedValue.toString()) > 0) {
					totalsurcharge += parseFloat(item.userAdjustedValue.toString());
				}

				if (item.userAdjustmentType === "discount" && item.userAdjustedValue && parseFloat(item.userAdjustedValue.toString()) > 0) {
					totaldiscount += parseFloat(item.userAdjustedValue.toString());
				}

				subtotal += item.discountedValue
				totalpayable += item.totalpayable;
				totalAmountIncurredDueTax += item.amountIncurredDueTax;
			});
		}
		if (recalculatedServicesList && Array.isArray(recalculatedServicesList)) {
			recalculatedServicesList.forEach(item => {
				if (item.userAdjustmentType === "surcharge" && item.userAdjustedValue && parseFloat(item.userAdjustedValue.toString()) > 0) {
					totalsurcharge += parseFloat(item.userAdjustedValue.toString());
				}

				if (item.userAdjustmentType === "discount" && item.userAdjustedValue && parseFloat(item.userAdjustedValue.toString()) > 0) {
					totaldiscount += parseFloat(item.userAdjustedValue.toString());
				}

				subtotal += item.discountedValue
				totalpayable += item.totalpayable;
				totalAmountIncurredDueTax += item.amountIncurredDueTax;
				totalServiceAmount += item.discountedValue
			});
		}

		return { subtotal, totaldiscount, totalAmountIncurredDueTax, totalServiceAmount, totalpayable, totalsurcharge };
	}

	static addNightAdjustmentInfo(items: any[], billingsettings: any): any[] {
		if (!Array.isArray(items)) return items;
		const isNightTime = PrimeBillingEnterprise.isNightTime(billingsettings);
		return items.map(item => {
			if (billingsettings && billingsettings.hasNightAdjustment) {
				return {
					...item,
					hasNightAdjustment: isNightTime,
					nightAdjustmentValue: Number(billingsettings.nightAdjustmentValue),
					nightAdjustmentMode: billingsettings.nightAdjustmentMode,
					nightAdjustmentStartTime: billingsettings.startTime,
					nightAdjustmentEndTime: billingsettings.endTime,
					isNightTime: isNightTime
				};
			} else {
				return {
					...item,
					hasNightAdjustment: false
				};
			}
		});
	}

	async handleServices(defaultCustomerInitData: any, appsettings: any, taxation: any, includeServices: boolean) {
		if (!includeServices) return;
		const servicesList = await this.recalculateInitServicesList(appsettings, taxation);
		(defaultCustomerInitData as any).servicesList = servicesList;
	}

	async recalculateInitServicesList(appsettings: any, taxation: any) {
		let servicesList = await new Services(0).getAllservices(this.tenantId, undefined, undefined);
		if (servicesList && Array.isArray(servicesList) && servicesList.length > 0) {
			servicesList = PrimeBillingEnterprise.reformatServicesList(servicesList, PrimeBillingEnterprise.isNightTime(appsettings.billingsettings), '', taxation.taxValue);
			servicesList = PrimeBillingEnterprise.applyNightAdjustmentsToTests(servicesList, appsettings.billingsettings, 'services');
			servicesList = PrimeBillingEnterprise.applyDiscountsToTests(servicesList);
			if (appsettings.includeTax && appsettings.includeTax === 1 && taxation && taxation.taxValue > 0) {
				servicesList = PrimeBillingEnterprise.applyTaxToTests(servicesList, taxation.taxValue);
			}
		}
		return servicesList;
	}

	static async recalculateInitServicesList(tenantId: number, appsettings: any, taxation: any) {
		let servicesList = await new Services(0).getAllservices(tenantId, undefined, undefined);
		if (servicesList && Array.isArray(servicesList) && servicesList.length > 0) {
			servicesList = PrimeBillingEnterprise.reformatServicesList(servicesList, PrimeBillingEnterprise.isNightTime(appsettings.billingsettings), '', taxation.taxValue);
			servicesList = PrimeBillingEnterprise.applyNightAdjustmentsToTests(servicesList, appsettings.billingsettings, 'services');
			servicesList = PrimeBillingEnterprise.applyDiscountsToTests(servicesList);
			if (appsettings.includeTax && appsettings.includeTax === 1 && taxation && taxation.taxValue > 0) {
				servicesList = PrimeBillingEnterprise.applyTaxToTests(servicesList, taxation.taxValue);
			}
		}
		return servicesList;
	}

	static async recalculateServicesList({
		billing,
		servicesList,
		billingsettings,
		isPromo,
		promoValid,
		promoCode,
		entitytype,
		entityid,
		promoDetails,
		includeTax,
		taxation
	}: any): Promise<any[]> {
		if (!servicesList || !Array.isArray(servicesList) || servicesList.length === 0) return [];
		const selectedServiceIds = servicesList.map((item: any) => item.id ?? item.keyid);
		const allServices = await billing.getAllServices();

		if (!Array.isArray(allServices) || allServices.length === 0) return [];
		let recalculatedServicesList = allServices
			.filter((service: any) => selectedServiceIds.includes(service.id ?? service.keyid))
			.map((service: any) => {
				const findServiceItem = servicesList.find((item: any) => (item.id ?? item.keyid) === (service.id ?? service.keyid));
				const userAdjustedValue = findServiceItem ? findServiceItem.userAdjustedValue : null;
				const userAdjustmentType = findServiceItem ? findServiceItem.userAdjustmentType : null;
				const price = service.servicePrice || 0;
				const discount = service.discount || 0;
				const promoDiscount = 0;
				const amountIncurredDueTax = 0;
				const totalcost = price;
				const totalpayable = price;
				return {
					...service,
					discountedValue: price,
					discount,
					amountIncurredDueTax,
					totalcost,
					totalpayable,
					promoDiscount,
					entityid,
					entitytype,
					userAdjustedValue,
					userAdjustmentType
				};
			});

		if (billingsettings && billingsettings.hasNightAdjustment) {
			recalculatedServicesList = PrimeBillingEnterprise.applyNightAdjustmentsToTests(recalculatedServicesList, billingsettings, 'services');
		}

		if (isPromo && promoValid && promoCode && promoDetails) {
			recalculatedServicesList = PrimeBillingEnterprise.applyPromoToItems(recalculatedServicesList, { type: promoDetails.discount_type, value: promoDetails.discount_value });
		} else {
			recalculatedServicesList = PrimeBillingEnterprise.applyDiscountsToTests(recalculatedServicesList);
		}

		if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
			recalculatedServicesList = PrimeBillingEnterprise.applyTaxToTests(recalculatedServicesList, taxation.taxValue);
		} else {
			recalculatedServicesList = PrimeBillingEnterprise.applyTaxToTests(recalculatedServicesList, 0);
		}
		return PrimeBillingEnterprise.addNightAdjustmentInfo(recalculatedServicesList, billingsettings);
	}



	static async lockBillingRecord(tenantId: number, billingid: number, status: string): Promise<boolean> {
		const connection = await KnexConnection(tenantId);
		return await connection('billing')
			.where({ billingid })
			.update({ islocked: 1, status: status })
			.then(result => result > 0)
			.catch(() => false);
	}

	static async isBillingLocked(tenantId: number, billingid: number): Promise<boolean> {
		const connection = await KnexConnection(tenantId);
		const result = await connection('billing')
			.where({ billingid })
			.select('islocked')
			.first();
		return result && parseInt(result.islocked) === 1
	}
}