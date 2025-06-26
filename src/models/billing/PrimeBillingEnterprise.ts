import KnexConnection from "../../database/KnexConnections";
import ApplicationSettings from "../application/appsettings/appset";
import { ApplicationSettingsData, AppSetting, billingsettings } from "../application/appsettings/Type";
import BillingStrategy from "../clincians/billingstrategy";
import { ReferralCodingRepo } from "../referral/repositories/ReferralCodingRepo";
import Services from "../services/services";
import { EntityType } from "./billing_shared_types";
import { SalesSessionRepo } from "./repositories/SalesSessionRepo";

export class PrimeBillingEnterprise {
	protected tenantId: number;
	protected connection: any;

	constructor(tenantId: number) {
		this.tenantId = tenantId;
		this.connection = KnexConnection(this.tenantId);
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

	async hasOutstandingDebt(patientId: number): Promise<boolean> {
		const outstandingAmount =  this.getCustomerOutstandingDebt(patientId) ;
		return parseFloat(outstandingAmount.toString()) > 0;
	}

	async validateActiveSession(branchid: number, errorMsg = 'No active session') {
		const sessionRepo = new SalesSessionRepo(this.tenantId);
		const today = (new Date() as unknown) as string;
		const sessionExists = await sessionRepo.hasActiveSessionForDate(today, branchid);
		if (!sessionExists) return errorMsg;
		return null;
	}

	async validateNoOutstandingDebt(patientId: number, errorMsg = 'Outstanding debt found') {
		const conn = await KnexConnection(this.tenantId);
		const result = await conn("billing").where("patientid", patientId).sum("outstanding as totalOutstanding").first();
		if (result?.totalOutstanding && Number(result.totalOutstanding) > 0) return errorMsg;
		return null;
	}

	async getReferralByCode(referalCode: number) {
		return await new ReferralCodingRepo(this.tenantId).findByCode(parseInt(referalCode.toString(), 10));
	}

	async getAllServices() {
		return await new Services(0).getAllservices(this.tenantId, undefined, undefined);
	}

	async getBillingHandler(entityType: EntityType, entityId: any) {
		return await new BillingStrategy().getProvidentialBillingHandler(this.tenantId, entityType, entityId, true);
	}
	async applyDiscountsToTests(tests: any[], type: 'test' | 'services') {
		return tests.map(test => {
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
				const base = item.discountedValue || 0;
				const share = Number(((base * promo.value) / 100).toFixed(2));
				return {
					...item,
					promoDiscount: share,
					discountedValue: Number((base - share).toFixed(2)),
					discount: Number(((item.discount || 0) + share).toFixed(2))
				};
			});
		} else if (promo.type === 'flat') {
			const totalPromoDiscount = Number(promo.value);
			const perItem = Number((totalPromoDiscount / items.length).toFixed(2));
			let distributed = 0;
			return items.map((item, idx) => {
				const base = item.discountedValue || 0;
				const share = idx === items.length - 1
					? Number((totalPromoDiscount - distributed).toFixed(2))
					: perItem;
				distributed += share;
				return {
					...item,
					promoDiscount: share,
					discountedValue: Number((base - share).toFixed(2)),
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
		if (!Array.isArray(tests) || !billingsettings || !billingsettings.hasNightAdjustment) return tests;
		const { nightAdjustmentValue, nightAdjustmentMode } = billingsettings;
		const isNight = this.isNightTime(billingsettings);
		return tests.map(test => {
			const base = test.discountedValue;
			const discount = Number(test.discount || 0);
			const discountedBase = base - discount;
			if (!isNight) {
				return { ...test, discountedValue: discountedBase, isNightTime: false };
			}
			let adjustedValue = discountedBase;
			if (nightAdjustmentMode === "percentage") {
				adjustedValue = Number((discountedBase + (discountedBase * Number(nightAdjustmentValue) / 100)).toFixed(2));
			} else if (nightAdjustmentMode === "absolute") {
				adjustedValue = Number((discountedBase + Number(nightAdjustmentValue)).toFixed(2));
			}
			return { ...test, discountedValue: adjustedValue, isNightTime: true };
		});
	}


	static applyDiscountsToTests<T extends { servicePrice?: number; discountedValue?: number; discount?: number; price?: number }>(tests: T[]): T[] {
		return tests.map(test => {
			const discount = test.discount || 0;
			const base = test.discountedValue;
			const discountedValue = base - discount;
			return { ...test, discountedValue, discount };
		});
	}

	static applyTaxToTests<T extends { discountedValue?: number; servicePrice?: number; price?: number; cost?: number; totalpayable?: number; totalcost?: number; discount?: number; promoDiscount?: number; nightAdjustmentValue?: number; nightAdjustmentMode?: string; isNightTime?: boolean }>(tests: T[], taxValue: number): T[] {
		if (!Array.isArray(tests) || !taxValue || taxValue <= 0) return tests;
		return tests.map(test => {
			const preDiscountValue = test.discountedValue
			const taxAmount = Number(((preDiscountValue * taxValue) / 100).toFixed(2));
			const totalcost = Number((preDiscountValue + taxAmount).toFixed(2));
			const discount = Number(test.discount || 0);
			const promo = Number(test.promoDiscount || 0);
			const totalpayable = Number((totalcost - discount - promo).toFixed(2));
			return {
				...test,
				amountIncurredDueTax: taxAmount,
				totalcost,
				totalpayable,
				discountedValue: totalpayable
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
		errorCodes
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
	}) {
		if (!patientId) return errorCodes.NO_PATIENT_ID;
		if (branchid === undefined || branchid === null) return errorCodes.NO_BRANCH_ID;
		if (billingSource === undefined || billingSource === null) return errorCodes.NO_BILLING_SOURCE;
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
		let subtotal = 0, totaldiscount = 0, totalAmountIncurredDueTax = 0, totalServiceAmount = 0;
		if (usedPackage) {
			recalculatedPackageList.forEach(item => {
				subtotal += item.discountedValue;
				totaldiscount += item.discount || 0;
			});
		} else {
			recalculatedCart.forEach(item => {
				subtotal += item.discountedValue || item.servicePrice || 0;
				totaldiscount += item.discount || 0;
				totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
			});
		}
		if (recalculatedServicesList && Array.isArray(recalculatedServicesList)) {
			recalculatedServicesList.forEach(item => {
				subtotal += item.discountedValue || item.servicePrice || 0;
				totaldiscount += item.discount || 0;
				totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
				totalServiceAmount += item.discountedValue || item.price || item.servicePrice || 0;
			});
		}
		return { subtotal, totaldiscount, totalAmountIncurredDueTax, totalServiceAmount };
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
				const price = service.servicePrice || 0;
				const discount = service.discount || 0;
				const promoDiscount = 0; // will be set later if promo is applied
				const amountIncurredDueTax = 0; // will be set later if tax is applied
				const totalcost = price; // will be updated if tax is applied
				const totalpayable = price - discount; // will be updated if promo/tax is applied
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
		}
		return PrimeBillingEnterprise.addNightAdjustmentInfo(recalculatedServicesList, billingsettings);
	}

}