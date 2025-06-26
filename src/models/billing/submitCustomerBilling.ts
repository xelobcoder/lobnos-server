import KnexConnection from "../../database/KnexConnections";
import { BillingSharedRepo } from "./billing_shared";
import { BillErrors, MultiTBillingDataShared } from "./billing_shared_types";
import { billErrors, serviceCategory, ServiceEntry } from "./billingclientTypes";
import { BillingTestItem, CustomerInitResponse } from "./billingTypes";
import { CustomerBillingCheckout } from "./customerBillingCheckout";
import { PrimeBillingPromoCodeRepo } from "./repositories/PrimeBillingPromoCodeRepo";

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
        try {
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

            const checkoutResult = await CustomerBillingCheckout.checkoutCustomerBilling({
                patientId,
                billingid,
                cart,
                servicesList: servicesProvided,
                paymentDetails,
                branchid,
                billingSource,
                referalCode,
                promoCode,
                isPromo,
                isPackageUsed,
                packageid,
                tenantId
            });
            if (typeof checkoutResult === 'string' || Array.isArray(checkoutResult)) {
                return { success: false, message: `Checkout validation failed: ${checkoutResult}` };
            }
            const data = checkoutResult.data;

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

            const taxValue = updatedBillingData.taxValue || 0;
            const taxList = updatedBillingData.taxList || null;
            const taxIncluded = updatedBillingData.taxIncluded || false;

            const processTestCart = await SubmitCustomerBilling.processTestCartWithoutRecalculation(
                updatedBillingData,
                billingID, taxValue, taxIncluded, taxList);

            const processNonTestServices = await SubmitCustomerBilling.processNonTestServices(
                updatedBillingData as unknown as MultiTBillingDataShared,
                updatedBillingData.servicesProvided,
                billingID,
                taxValue,
                taxList
            );

            const allEntries = [...processNonTestServices, ...processTestCart];
            const Multi = new BillingSharedRepo();

            if (allEntries.length > 0) {
                const loadAllServices = await Multi
                    .mapAndInsertServices(this.tenantId, allEntries, billingID, trx);

                if (loadAllServices.length > 0) {
                    throw new Error(BillErrors.UnableToLoadServices);
                }


                const totalcost = data.totalcost;
                const totalservicesAmount = data.totalServiceAmountPayable;
                const totalAmountPayable = data.amountPayable;
                const testPayableAmount = data.testPayableAmount || 0;
                const totaldiscount = data.totaldiscount || 0;
                const totalAmountIncurredDueTax = data.totalAmountIncurredDueTax;
                const totalOutstanding = data.outstanding || 0;
                const balance = data.paid - this.payload.paid;


                const updateData = {
                    totalTransactionCost: totalcost,
                    totalcost: totalcost,
                    totalServiceAmountPayable: totalservicesAmount,
                    amountPayable: totalAmountPayable,
                    testPayableAmount: testPayableAmount,
                    totaldiscount: totaldiscount,
                    totalAmountIncurredDueTax: totalAmountIncurredDueTax,
                    outstanding: totalOutstanding,
                    paid: updatedBillingData.paid,
                    balance: balance,
                    totalrefunded: 0,
                    isPromo: data.isPromo || false,
                    promoValue: data.promoValue || 0,
                    promoMethod: data.promoMethod || promoMethod,
                    promoCodeId: data.promoCodeId || promoCode,
                }

                const result = await trx("billing")
                    .where("billingid", billingID)
                    .update({
                        billingid: billingID,
                        patientid: updatedBillingData.patientId,
                        totalcost: updateData.totalcost,
                        totalTransactionCost: updateData.totalTransactionCost,
                        totalrefunded: updateData.totalrefunded,
                        discount: updateData.totaldiscount,
                        paid: this.payload.paid,
                        payable: updateData.amountPayable,
                        outstanding: updateData.outstanding,
                        balance: updateData.balance,
                        clientstatus: status || "normal",
                        amountIncurredDueTax: updateData.totalAmountIncurredDueTax,
                        branchid: updatedBillingData.branchid,
                        isPromo: updateData.isPromo,
                        promoValue: updateData.promoValue,
                        promoMethod: updateData.promoMethod,
                        promoCodeId: updateData.promoCodeId,
                    });

                    console.log("Billing update result:", result);

                if (!result) throw new Error("unable to update billing record");

                if (data.isPromo && data.promdo && data.promo.id) {
                    const promoRepo = new PrimeBillingPromoCodeRepo(this.tenantId);
                    await promoRepo.incrementUsage(data.promo.id, trx);
                }

                    const paymentsArr = Array.isArray(this.payload.payments) ? this.payload.payments : [];
                    if (paymentsArr.length > 0) {
                        for (const payment of paymentsArr) {
                            const paymentMode = payment.mode;
                            const paymentAmount = payment.amount;
                            const employeeId = payment.employeeid || this.payload.employeeid;
                            if (!paymentMode || !employeeId) {
                                throw new Error("Missing mode or employeeid in payment record.");
                            }
                            await BillingSharedRepo.insertBillHistory(
                                trx,
                                billingID,
                                paymentMode,
                                paymentAmount,
                                employeeId,
                                "credit"
                            );
                        }
                    } else {
                        if (!this.payload.employeeid) {
                            throw new Error("Missing employeeid in billing data.");
                        }
                        await BillingSharedRepo.insertBillHistory(
                            trx,
                            billingID,
                            null,
                            this.payload.paid,
                            this.payload.employeeid,
                            "credit"
                        );
                    }
                    await trx.commit();
            }
            return { success: true, message: "Billing submitted successfully", billingid: billingID };
        } catch (error: any) {
            console.log("Error in submitCustomerBilling:", error);
            return { success: false, message: error && error.message ? error.message : "Unknown error in billing submission" };
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
        taxIncluded: boolean,
        taxList: any = null
    ): Promise<any[]> {
        let entityType: string = "general";
        let entityId: number = 0;
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        let registrationType: string = "self";
        if (billingData.billingSource > 1 && billingData.entityId) {
            entityId = parseInt(billingData.entityId.toString());
            console.log("Entity ID:", entityId);
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
                    cost: item.actualPrice,
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
                    taxIncluded: taxIncluded == true ? 1 : 0,
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
        let registrationType = "self";

        const entityId = billingData.entityId ? parseInt(billingData.entityId.toString()) : null;

        switch (billingData.billingSource) {
            case 2:
                organizationId = entityId;
                registrationType = "organization";
                break;
            case 3:
            case 4:
                insuranceId = entityId;
                registrationType = "insurance";
                break;
            case 6:
                clinicianId = entityId;
                registrationType = "clinician";
                break;
        }

        const { employeeid, branchid, taxIncluded, billingSource, isPackageUsed } = billingData;

        return await Promise.all(
            servicesProvided
                .map(async (item: any) => {
                    return {
                        billingid: billingID,
                        trackId: item.keyid,
                        cost: item.servicePrice,
                        employeeid,
                        serviceCategory: serviceCategory[5],
                        categoryTrackId: 5,
                        clinicianId,
                        organizationId,
                        registrationType,
                        branchid,
                        isoutsourced: 0,
                        outsourceid: 0,
                        serviceAddedOn: new Date(),
                        taxList,
                        taxValue,
                        amountIncurredDueTax: item.amountIncurredDueTax,
                        taxIncluded,
                        discount: item.discount,
                        totalcost: item.totalcost,
                        totalpayable: item.totalpayable,
                        isNHIS: billingSource === 4 ? 1 : 0,
                        isPHIS: billingSource === 3 ? 1 : 0,
                        insuranceid: insuranceId || null,
                        claimCode: null,
                        hasNightAdjustment: item.isNightTime,
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

