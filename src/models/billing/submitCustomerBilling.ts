import KnexConnection from "../../database/KnexConnections";
import { BillingSharedRepo } from "./billing_shared";
import { BillErrors, MultiTBillingDataShared } from "./billing_shared_types";
import { billErrors, serviceCategory, ServiceEntry } from "./billingclientTypes";
import { BillingTestItem, CustomerInitResponse } from "./billingTypes";
import { CustomerBillingInit } from "./initCustomerBilling";

export class SubmitCustomerBilling {
    private payload: any;
    private tenantId: number;
    private connection: any;
    constructor(payload: any, tenantId: number) {
        this.payload = payload;
        this.tenantId = tenantId;
        this.connection = KnexConnection(this.tenantId);
    }

    async submit(): Promise<{ success: boolean; message: string; billingid?: number }> {
        const {
            tenantId,
            patientId,
            billingid,
            cart,
            servicesProvided,
            paymentDetails,
            branchid,
            billingSource,
            referalCode,
            promoCode,
            isPromo,
            isPackageUsed,
            packageid,
            amountPayable,
            employeeid,
            samplingCenter,
            payments,
            status,
            isConditionsUnderstood,
            hasNightAdjustment,
            promoMethod,
            ...rest
        } = this.payload;

        const billingInit = CustomerBillingInit.getInstance(tenantId);
        const checkoutResult = await billingInit.init({
            entityId: null,
            entityType: null,
            patientId,
            billingid,
            isPackageUsed,
            packageid,
            includeServices: true,
            branchid,
            billingSource,
            referalCode
        });
        if (typeof checkoutResult === 'string' || Array.isArray(checkoutResult)) {
            return { success: false, message: `Checkout validation failed: ${checkoutResult}` };
        }

        const data = checkoutResult;
        const summaryFields = [
            'subtotal',
            'totaldiscount',
            'totalAmountIncurredDueTax',
            'totalServiceAmount',
            'amountPayable',
        ];
        for (const field of summaryFields) {
            if (
                typeof data[field] === 'number' &&
                typeof this.payload[field] === 'number' &&
                Math.abs(data[field] - this.payload[field]) > 0.01
            ) {
                return { success: false, message: `Submitted ${field} (${this.payload[field]}) does not match recalculated value (${data[field]}).` };
            }
        }

        const isValid = await SubmitCustomerBilling.validateBillingRequestBody(this.payload, tenantId);

        if (isValid !== true) {
            return { success: false, message: `Validation failed: ${isValid}` };
        }

        let updatedBillingData: CustomerInitResponse = this.payload;

        if (updatedBillingData.isPackageUsed && !updatedBillingData.packageid) {
            updatedBillingData.cart = data.packageTestList;
        }

        const conn = await this.connection;
        const trx = await conn.transaction();
        const billingID = await BillingSharedRepo.generateBillingID(
            this.payload.patientid,
            this.tenantId,
            trx
        );

        await SubmitCustomerBilling.processTestCartWithoutRecalculation(
            updatedBillingData,
            billingID,
            updatedBillingData.taxValue,
            trx
        );


        const testResult = await BillingSharedRepo.processTestCart(
            this.tenantId,
            updatedBillingData as unknown as MultiTBillingDataShared,
            billingID,
            updatedBillingData.taxValue,
            updatedBillingData.taxList,
            trx
        );


        // Insert non-test services
        const Multi = new BillingSharedRepo();
        const serviceEntries = await Multi.mapAndInsertServices(this.tenantId, updatedBillingData.cart, billingID, trx);

        // Combine test results and service entries

        const allEntries = [...testResult, ...serviceEntries];

        if (allEntries.length > 0) {
            const loadAllServices = await new BillingSharedRepo()
                .mapAndInsertServices(this.tenantId, allEntries, billingID, trx);

            if (loadAllServices.length > 0) {
                throw new Error(BillErrors.UnableToLoadServices);
            }


            console.log("All services loaded successfully", allEntries.length);
            const totaldiscount = checkoutResult.totaldiscount || 0;
            const totalAmountIncurredDueTax = checkoutResult.totalAmountIncurredDueTax || 0;
            const totalOutstanding = updatedBillingData.outstanding || 0;

            // const updateData = {
            //     totalTransactionCost: billing_final_values.totalcost,
            //     totalcost: billing_final_values.totalcost,
            //     paid: billingData.paid,
            //     payable: payableAfterPromo,
            //     discount: billing_final_values.totalDiscount,
            //     amountIncurredDueTax: billing_final_values.amountIncurredDueTax,
            //     outstanding: Number((payableAfterPromo - billingData.paid).toFixed(2)),
            //     totalrefunded: 0,
            //     isPromo: billingData.isPromo || false,
            //     promoValue: promoValue,
            //     promoMethod: promoMethod,
            //     promoCodeId: promoCodeId,
            // }

        }
    }
    static async validateBillingRequestBody(billingData: any, tenantId: number): Promise<true | string> {
        const {
            cart,
            servicesProvided,
            employeeid,
            paymentmode,
            branchid,
            isPromo,
            promo,
            billingSource,
            patientId,
            entityId,
            amountPayable,
            paid,
            payments
        } = billingData;

        if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
            return "Cart and servicesProvided must be arrays.";
        }
        if (cart.length === 0 && servicesProvided.length === 0) {
            return "Both cart and servicesProvided cannot be empty.";
        }
        if (!employeeid || typeof employeeid !== "number") {
            return "Invalid or missing employeeid.";
        }

        if (!branchid || typeof branchid !== "number") {
            return "Missing or invalid samplingCenter (branch id).";
        }
        if (typeof amountPayable !== "number" || typeof paid !== "number") {
            return "Amount payable and paid must be numbers.";
        }
        if (!patientId || typeof patientId !== "number") {
            return "Missing or invalid patientId.";
        }
        if (!(await BillingSharedRepo.checkPatientIdExist(patientId, tenantId))) {
            return "Patient does not exist.";
        }

        if (isPromo && (!promo || !promo.code)) {
            return "Promo code is required when isPromo is true.";
        }

        if (payments && Array.isArray(payments)) {
            for (const payment of payments) {
                if (!payment.mode || !(await BillingSharedRepo.validatePaymentModeId(parseInt(payment.mode.toString(), 10), tenantId))) {
                    return "Invalid payment mode in payments array.";
                }
            }
        }

        return true;
    }

    static async processTestCartWithoutRecalculation(
        billingData: any,
        billingID: number,
        taxValue: number,
        taxList: any,
    ): Promise<any[]> {
        let entityType: string = "general";
        let entityId: number = 0;
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        let registrationType: string = "self";
        if (billingData.billingSource > 1 && billingData.entityId) {
            entityId = parseInt(billingData.entityId.toString());
            switch (billingData.billingSource) {
                case 2:
                    entityType = "organization";
                    organizationId = entityId;
                    registrationType = "organization";
                    break;
                case 4:
                    entityType = "insurance";
                    insuranceId = entityId;
                    registrationType = "insurance";
                    break;
                case 3:
                    entityType = "insurance";
                    insuranceId = entityId;
                    registrationType = "self";
                    break;
                case 6:
                    entityType = "clinician";
                    clinicianId = entityId;
                    registrationType = "clinician";
                    break;
                default:
                    registrationType = "self";
            }
        } else if (!billingData.billingSource || billingData.billingSource === 0) {
            registrationType = "self";
        }

        const result = await Promise.all(
            billingData.cart.map(async (item: BillingTestItem) => {
                return {
                    billingid: billingID,
                    trackId: item.testid,
                    cost: item.cost,
                    employeeid: billingData.employeeid,
                    serviceCategory: serviceCategory[billingData.billingSource],
                    categoryTrackId: billingData.billingSource,
                    clinicianId,
                    organizationId,
                    registrationType,
                    branchid: billingData.branchid,
                    isoutsourced: item.isoutsourced === 1 ? 1 : 0,
                    outsourceid: item.outsourceid || null,
                    serviceAddedOn: new Date(),
                    taxList: typeof taxList === "string" ? taxList : null,
                    taxValue,
                    amountIncurredDueTax: item.amountIncurredDueTax,
                    taxIncluded: billingData.taxIncluded,
                    discount: item.discount,
                    totalcost: item.totalcost,
                    totalpayable: item.totalpayable,
                    isNHIS: billingData.billingSource === 4 ? 1 : 0,
                    isPHIS: billingData.billingSource === 3 ? 1 : 0,
                    insuranceid: insuranceId,
                    claimCode: null,
                    hasNightAdjustment: item.hasNightAdjustment,
                    nightAdjustmentMode: item.nightAdjustmentMode,
                    nightAdjustmentValue: item.nightAdjustmentValue || 0,
                    isPackageUsed: billingData.isPackageUsed ? 1 : 0,
                    packageid: billingData.packageid || null
                };
            })
        );

        console.log(result);
        return result;
    }



    static async processNonTestServices(
        billingData: MultiTBillingDataShared,
        servicesProvided: {
            totalcost: number;
            totalDiscount: number;
            payable: number;
            amountIncurredDueTax: number;
            totalServiceCost: number;
            hasNightAdjustment: boolean;
            nightAdjustmentMode: "percentage" | "absolute" | "none";
            nightAdjustmentValue: number;
            isPackageUsed: boolean;
            packageid: number | null;
            keyid: number;
            servicePrice: number;
        }[],
        billingID: number,
        taxValue: number,
        taxList: any,
    ): Promise<ServiceEntry[]> {
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;

        const entityId = billingData.entityId ? parseInt(billingData.entityId.toString()) : null;

        switch (billingData.billingSource) {
            case 2:
                organizationId = entityId;
                break;
            case 3:
            case 4:
                insuranceId = entityId;
                break;
            case 6:
                clinicianId = entityId;
                break;
        }
        const { employeeid, samplingCenter, taxIncluded, type, billingSource, isPackageUsed } = billingData;

        return await Promise.all(
            servicesProvided
                .map(async (item) => {
                    return {
                        billingid: billingID,
                        trackId: item.keyid,
                        cost: item.cost,
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
                        discount: item.discount,
                        totalcost: item.totalcost,
                        totalpayable: item.discountedValue,
                        isNHIS: billingSource === 4 ? 1 : 0,
                        isPHIS: billingSource === 3 ? 1 : 0,
                        insuranceid: insuranceId || null,
                        claimCode: null,
                        hasNightAdjustment: item.hasNightAdjustment,
                        nightAdjustmentMode: item.nightAdjustmentMode,
                        nightAdjustmentValue: item.nightAdjustmentValue,
                        isPackageUsed: isPackageUsed ? 1 : 0,
                        packageid: item.packageid || null,
                    };
                })
        );
    }

    public async loadMultipleServices(services: any[], billingid: number, tenantId: number, trx?: any) {
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

                if (outcome && item[5] != 5 && item[1]) {
                    try {
                        await BillingSharedRepo.AddtoTestAscenstion(tenantId, outcome[0], billingid, item[1], queryRunner);
                    } catch (err) {
                        throw new Error(billErrors.unableToLoadTestAscension);
                    }
                }
            } catch (err) {
                console.error("Error inserting service:", err);
                insertionErrors.push(err);
            }
        }

        return insertionErrors;
    }

    public async mapAndInsertServices(tenantId: number, allEntries: ServiceEntry[], billingid: number, trx?: any) {
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
        } catch (err) {
            console.log('Error Loading services ')
            throw err;
        }
    }
}

