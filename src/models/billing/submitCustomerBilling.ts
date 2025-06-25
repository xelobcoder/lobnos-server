import KnexConnection from "../../database/KnexConnections";
import { BillingSharedRepo } from "./billing_shared";
import { serviceCategory } from "./billingclientTypes";
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

        // Step 1: Re-evaluate billing using checkout logic
        const billingInit = new CustomerBillingInit(tenantId);
        const checkoutResult = await billingInit.checkoutCustomerBilling({
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
            packageid
        });
        if (!checkoutResult.success) {
            return { success: false, message: `Checkout validation failed: ${checkoutResult.message}` };
        }

        const data = checkoutResult.data;
        // Step 2: Compare recalculated summary fields with submitted payload (excluding 'paid')
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


        let  updatedBillingData :CustomerInitResponse = this.payload

        if (updatedBillingData.isPackageUsed && !updatedBillingData.packageid) {
            updatedBillingData.cart = checkoutResult.data.packageTestList;
        }


        const conn = await this.connection;
        const trx = await conn.transaction();
        // Generate billing ID inside transaction
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

        // Validate payments array and each payment's paymentmode
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
                    cost: item.discountedValue,
                    employeeid: billingData.employeeid,
                    serviceCategory: serviceCategory[billingData.billingSource],
                    categoryTrackId: billingData.billingSource,
                    clinicianId,
                    organizationId,
                    registrationType,
                    branchid: billingData.samplingCenter,
                    isoutsourced: item.isoutsourced === 1 ? 1 : 0,
                    outsourceid: item.outsourceid || null,
                    serviceAddedOn: new Date(),
                    taxList: typeof taxList === "string" ? taxList : null,
                    taxValue,
                    amountIncurredDueTax: item.amountIncurredDueTax,
                    taxIncluded: billingData.taxIncluded,
                    discount: item.discount,
                    totalcost: item.totalcost,
                    totalpayable: item.discountedValue || item.totalpayable,
                    isNHIS: billingData.billingSource === 4 ? 1 : 0,
                    isPHIS: billingData.billingSource === 3 ? 1 : 0,
                    insuranceid: insuranceId,
                    claimCode: null,
                    hasNightAdjustment: item.hasNightAdjustment,
                    nightAdjustmentMode: item.nightAdjustmentMode,
                    nightAdjustmentValue: item.nightAdjustmentValue || 0,
                    isPackageUsed: billingData.isPackageUsed ? 1 : 0,
                    packageid: billingData.packageid || null
                }
            })
        );

        console.log(result)
        return result;
    }
}

