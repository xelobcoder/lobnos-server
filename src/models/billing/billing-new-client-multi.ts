import KnexConnection from "../../database/KnexConnections";
import { BillingSharedRepo } from "./billing_shared";
import { BillErrors, MultiTBillingDataShared } from "./multi/billing_shared_types";
import { billErrors, serviceCategory, ServiceEntry, ValidationError } from "./billingclientTypes";
import { BillingTestItem, CustomerInitResponse } from "./multi/billingTypes";
import { PrimeBillingPromoCodeRepo } from "./repositories/PrimeBillingPromoCodeRepo";
import { CustomerBillingCheckout } from "./multi/customerBillingCheckout";
import { EntityType } from "../clincians/c.dev.type";
import { OutsourcedTestTrackingRepo } from "../operations/OutsourcedTestTrackingRepo";
import { OperationsFailures } from "../operations/types";
import { PrimeEventsSMSDataSource } from "../application/sms/events/PrimeEventsDataSource";
import OutsourcedCases from "../organization/outsourcingOrganization/outsourcedCases";


export class SubmitCustomerBilling {

    static getPaidAmountAndStatus(item: { paidamount?: any, paymentstatus?: string, totalpayable?: number }): { paidamount: number, paymentstatus: string, outstanding: number } {
        const paidamount = (typeof item.paidamount !== 'undefined' && !isNaN(item.paidamount) && typeof parseFloat(item.paidamount.toString()) === 'number')
            ? Number(item.paidamount)
            : 0;
        let paymentstatus: string;
        const p_totalpayable = isNaN(parseInt(item.totalpayable?.toString() || '0')) ? 0 : parseFloat(item.totalpayable?.toString() || '0');
        const p_paidamount = isNaN(parseInt(item.paidamount?.toString() || '0')) ? 0 : parseFloat(item.paidamount?.toString() || '0');
        const outstanding: number = p_totalpayable - p_paidamount;
        if (p_paidamount != null) {
            if ((p_totalpayable && p_paidamount === p_totalpayable) || p_totalpayable === 0) {
                paymentstatus = 'paid';
            } else if (p_paidamount > 0) {
                paymentstatus = 'partial';
            } else {
                paymentstatus = 'pending';

            }
        } else {
            paymentstatus = 'pending';
        }
        return { paidamount, paymentstatus, outstanding };
    }


    private payload: any;
    private tenantId: number;
    private connection: any;
    constructor(payload: any, tenantId: number) {
        this.payload = payload;
        this.tenantId = tenantId;
        this.connection = KnexConnection(this.tenantId);
    }

    async adjustmentCorrectionDetermination(billingid: number, currentEntity: { entity_type: EntityType, entityid: number }): Promise<void> {
        // 1. using the billingid we will load and get the entity information 
        // 2. use the services and test and use the current entity information and compute the necessary adjustments
        // 3. compare the two and forward the details to the frontend
    }

    async submit(): Promise<{ status: boolean; message: string; billingid?: number }> {
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
                nhismembershipid,
                claimscheckcode,
                isPromo,
                writeOffOutstanding,
                isPackageUsed,
                packageid,
                amountPayable,
                employeeid,
                samplingCenter,
                isAdjustment,
                adjustmentdate,
                adjustmentType,
                organizationId,
                clinicianId,
                adjustmentReason,
                payments,
                status,
                entitytype,
                entityId,
                isPayAll,
                entityid,
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
                entityid,
                entitytype,
                tenantId
            });


            if (checkoutResult.success == false) {
                return { status: false, message: `Checkout validation failed: ${checkoutResult.message}` };
            }


            if (billingSource == 4 && (!nhismembershipid || !claimscheckcode || isNaN(nhismembershipid) || isNaN(claimscheckcode))) {
                return { status: false, message: "Please Provide Valid NHIS MEMBERSHIP ID and Claims Check Code to continue " }
            }

            let hasRelatedBilling = false;

            if (this.payload.billingid) {
                const isBillingIdValid = await BillingSharedRepo.checkValidityOfBillingID(this.payload.billingid, this.tenantId);
                if (!isBillingIdValid) return { status: false, message: billErrors.NoValidBilling };
                hasRelatedBilling = true;
            }


            if (hasRelatedBilling) {
                const canAdjust = await BillingSharedRepo.canAdjustBilling(this.payload.billingid, this.tenantId);
                if (!canAdjust.status) {
                    return { status: false, message: canAdjust.message as string };
                }
            }

            if (typeof checkoutResult === 'string' || Array.isArray(checkoutResult)) {
                return { status: false, message: `Checkout validation failed: ${checkoutResult}` };
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
                if (typeof data[field] === 'number' && typeof this.payload[field] === 'number' && Math.abs(data[field] - this.payload[field]) > 0.01) {
                    return { status: false, message: `Submitted ${field} (${this.payload[field]}) does not match recalculated value (${data[field]}).` };
                }
            }

            let updatedBillingData: CustomerInitResponse = this.payload;

            if (updatedBillingData.isPackageUsed && !updatedBillingData.packageid) {
                updatedBillingData.cart = data.packageTestList;
            }


            const conn = await this.connection;
            const trx = await conn.transaction();

            let billingID = 0;

            if (!hasRelatedBilling) {
                billingID = await BillingSharedRepo.generateBillingID(
                    this.payload.patientid || this.payload.patientId,
                    this.tenantId,
                    this.payload.branchid || this.payload.branchId,
                    this.payload.employeeid || this.payload.employeeId,
                    trx
                );
            } else {
                billingID = this.payload.billingid;
            }


            const taxValue = updatedBillingData.taxValue || 0;
            const taxList = updatedBillingData.taxList || null;
            const taxIncluded = updatedBillingData.taxIncluded || false;

            const processTestCart = await SubmitCustomerBilling.processTestCartWithoutRecalculation(
                updatedBillingData,
                billingID, taxValue, taxIncluded, taxList, trx, hasRelatedBilling,
                this.payload.billingid);


            // console.log(processTestCart, "processTestCart")
            // throw new Error("testing");

            const processNonTestServices = await SubmitCustomerBilling.processNonTestServices(
                updatedBillingData as unknown as MultiTBillingDataShared,
                (updatedBillingData.servicesProvided || []).map(service => ({
                    ...service,
                    amountPaid: typeof service.amountPaid === 'number' ? service.amountPaid : 0,
                    status: service.status || 'pending'
                })),
                billingID,
                taxValue,
                taxList,
                hasRelatedBilling,
                this.payload.billingid
            );

            const allEntries = [...processNonTestServices, ...processTestCart];
            const Multi = new BillingSharedRepo();
            if (allEntries.length > 0) {
                const loadAllServices = await Multi
                    .mapAndInsertServices(this.tenantId, allEntries, billingID, trx);

                if (loadAllServices.length > 0) {
                    throw new Error(BillErrors.UnableToLoadServices);
                }

                let totalcost = 0;
                let totalservicesAmount = 0;
                let totalAmountPayable = checkoutResult.data.amountPayable || 0;
                let testPayableAmount = 0;
                let totaldiscount = 0;
                let totalAmountIncurredDueTax = 0;
                let totalOutstanding = 0;
                let balance = 0;
                let writeOffAmount = 0;
                let overallPaymentsMade = updatedBillingData.paid;
                let status = this.payload.paid == amountPayable ? "paid" : this.payload.paid > 0 ? "partial" : "pending";
                testPayableAmount = data.testPayableAmount || 0;
                totalcost = data.totalcost;
                totalservicesAmount = data.totalServiceAmountPayable;
                totaldiscount = data.totaldiscount || 0;
                totalAmountIncurredDueTax = data.totalAmountIncurredDueTax;
                totalOutstanding = Math.max(amountPayable - updatedBillingData.paid, 0);
                balance = totalOutstanding > 0 ? 0 : updatedBillingData.paid - totalAmountPayable;
                const surcharges = checkoutResult.data?.totalsurcharge || 0;


                const updateData = {
                    totalTransactionCost: totalcost,
                    totalcost: totalcost,
                    totalServiceAmountPayable: totalservicesAmount,
                    amountPayable: totalAmountPayable,
                    testPayableAmount: testPayableAmount,
                    totaldiscount: totaldiscount,
                    totalAmountIncurredDueTax: totalAmountIncurredDueTax,
                    outstanding: totalOutstanding,
                    paid: overallPaymentsMade,
                    surcharges,
                    balance: balance,
                    status,
                    totalrefunded: 0,
                    isPromo: data.isPromo || false,
                    promoValue: data.promoValue || 0,
                    promoMethod: data.promoMethod || promoMethod,
                    promoCodeId: data.promoCodeId || promoCode,
                    lastupdatedby: employeeid || this.payload.employeeid,
                }

                const { adjustmentType, isAdjustment, adjustmentReason } = this.payload;

                if (isAdjustment && adjustmentType === "correction" && this.payload.billingid) {
                    await trx("billing")
                        .where({ billingid: this.payload.billingid })
                        .update({
                            adjustmentType: "correction",
                            adjustmentReason,
                            adjustedBy: employeeid || this.payload.employeeid,
                            adjustmentdate: new Date(),
                            isAdjustment: 1,
                            islocked: 1,
                            lastupdatedby: employeeid || this.payload.employeeid,
                        });

                    await trx("dboservices")
                        .where({ billingid: this.payload.billingid })
                        .update({
                            isAdjustment: 1,
                            isCorrected: 1,
                            relatedBillingid: parseInt(this.payload.billingid),
                            isLocked: 1,
                        });
                }


                const dataToUpdate = {
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
                    status,
                    amountIncurredDueTax: updateData.totalAmountIncurredDueTax,
                    branchid: updatedBillingData.branchid,
                    isPromo: updateData.isPromo,
                    promoValue: updateData.promoValue,
                    surcharges: updateData.surcharges,
                    additionalinformation: this.payload.additioninformation || null,
                    promoMethod: updateData.promoMethod ? updateData.promoMethod : null,
                    promoCodeId: updateData.promoCodeId ? updateData.promoCodeId : null,
                    isAdjustment: hasRelatedBilling ? 1 : 0,
                    adjustmentType: hasRelatedBilling ? "addition" : null,
                    adjustedBy: hasRelatedBilling ? employeeid || this.payload.employeeid : null,
                    adjustmentdate: hasRelatedBilling ? new Date() : null,
                    adjustmentReason: hasRelatedBilling ? 'New Billing service added' : null,
                    relatedBillingId: hasRelatedBilling ? parseInt(this.payload.billingid) : null,
                    writeoff: writeOffOutstanding ? writeOffAmount : 0,
                    lastupdatedby: employeeid || this.payload.employeeid,
                }


                // if adjustment is addition we need to add the related billin item to this current one and update the old instead of creating a new one

                let AdditionAdjustmentBillingData = null;


                if (isAdjustment && adjustmentType === "addition" && this.payload.billingid) {
                    let previousTransaction = await trx("billing").where({ billingid: this.payload.billingid }).first();

                    if (previousTransaction) {
                        const previousOutstanding = previousTransaction.outstanding || 0;
                        const newOutstanding = parseFloat(previousOutstanding) + parseFloat(dataToUpdate.outstanding.toString());
                        const previousAmountPayable = previousTransaction.payable || 0;
                        const newAmountPayable = parseFloat(previousAmountPayable) + dataToUpdate.payable;
                        const previousTotalCost = previousTransaction.totalcost || 0;
                        const newTotalCost = parseFloat(previousTotalCost) + dataToUpdate.totalcost;
                        const previousPaid = previousTransaction.paid || 0;
                        const previousTotalTransactionCost = previousTransaction.totalTransactionCost || 0;
                        const newTotalTransactionCost = parseFloat(previousTotalTransactionCost) + dataToUpdate.totalTransactionCost;
                        const previousDiscount = previousTransaction.discount || 0;
                        const newDiscount = parseFloat(previousDiscount) + dataToUpdate.discount;
                        const newPaid = parseFloat(previousPaid) + dataToUpdate.paid;
                        const previousBalance = previousTransaction.balance || 0;
                        const newBalance = previousBalance + dataToUpdate.balance;
                        const previousRefunded = previousTransaction.totalrefunded || 0;
                        const newRefunded = parseFloat(previousRefunded) + dataToUpdate.totalrefunded || 0;
                        const previousAmmountIncurredDueTax = previousTransaction.amountIncurredDueTax || 0;
                        const newAmmountIncurredDueTax = parseFloat(previousAmmountIncurredDueTax) + dataToUpdate.amountIncurredDueTax;
                        const adjustmentReason = this.payload.adjustmentReason || 'Addition of new services/tests';
                        const totalsurcharges = parseFloat(previousTransaction.surcharges || 0) + parseFloat(dataToUpdate.surcharges || 0);

                        let newStatus = "pending";
                        if (newPaid >= newAmountPayable) {
                            newStatus = "paid";
                        } else if (newPaid > 0 && newPaid < newAmountPayable) {
                            newStatus = "partial";
                        }


                        AdditionAdjustmentBillingData = {
                            totalcost: newTotalCost,
                            totalTransactionCost: newTotalTransactionCost,
                            totalrefunded: newRefunded,
                            discount: newDiscount,
                            paid: newPaid,
                            payable: newAmountPayable,
                            outstanding: newOutstanding,
                            balance: newBalance,
                            status: newStatus,
                            amountIncurredDueTax: newAmmountIncurredDueTax,
                            branchid: updatedBillingData.branchid,
                            isPromo: updateData.isPromo,
                            promoValue: updateData.promoValue,
                            additionalinformation: this.payload.additioninformation || null,
                            promoMethod: updateData.promoMethod ? updateData.promoMethod : null,
                            promoCodeId: updateData.promoCodeId ? updateData.promoCodeId : null,
                            isAdjustment: hasRelatedBilling ? 1 : 0,
                            adjustmentType: hasRelatedBilling ? "addition" : null,
                            adjustedBy: hasRelatedBilling ? employeeid || this.payload.employeeid : null,
                            adjustmentdate: hasRelatedBilling ? new Date() : null,
                            adjustmentReason,
                            relatedBillingId: hasRelatedBilling ? parseInt(this.payload.billingid) : null,
                            writeoff: writeOffOutstanding ? writeOffAmount : 0,
                            patientid: updatedBillingData.patientId,
                            lastupdatedby: employeeid || this.payload.employeeid,
                            surcharges: totalsurcharges,
                        }
                    }
                }


                const finalUpdateData = hasRelatedBilling && adjustmentType == "addition" ? AdditionAdjustmentBillingData : dataToUpdate;
                const finalBillingId = hasRelatedBilling && adjustmentType == "addition" ? parseInt(this.payload.billingid) : billingID;
                
                const result = await trx("billing")
                    .update(finalUpdateData).where({ billingid: finalBillingId });

                if (!result) throw new Error("unable to update billing record");
                if (data.isPromo && data.promoCode && data.promoDetails.id) {
                    const promoRepo = new PrimeBillingPromoCodeRepo(this.tenantId);
                    await promoRepo.incrementUsage(data.promoDetails.id, trx);
                }

                const paymentsArr = Array.isArray(this.payload.payments) ? this.payload.payments : [];
                if (Array.isArray(paymentsArr) && paymentsArr.length > 0) {
                    for (const payment of paymentsArr) {
                        const paymentMode = payment.mode;
                        const paymentAmount = payment.amount;
                        const employeeId = payment.employeeid || this.payload.employeeid;

                        if (!paymentMode || !employeeId) {
                            throw new Error("Missing mode or employeeid in payment record.");
                        }

                        await BillingSharedRepo.insertBillHistory(
                            this.tenantId,
                            trx,
                            billingID,
                            paymentMode,
                            paymentAmount,
                            employeeId,
                            "credit"
                        );
                    }
                }




                await trx.commit();

                
                const parsedEmployeeId = parseInt(employeeid.toString(), 10);
                const repo = new PrimeEventsSMSDataSource(tenantId);
                await repo.paymentConfirmationEvent(tenantId, finalBillingId, parsedEmployeeId);


            }

            return { status: true, message: "Order submitted successfully", billingid: billingID };
        } catch (error: any) {
            return { status: false, message: error && error.message ? error.message : "Unknown error in billing submission" };
        }
    }
    static async validateBillingRequestBody(billingData: any, tenantId: number): Promise<true | string> {
        const {
            cart,
            servicesProvided,
            employeeid,
            branchid,
            isPromo,
            promo,
            patientId,
            amountPayable,
            paid,
            payments
        } = billingData;

        if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
            return ValidationError.CartAndServicesNotArrays;
        }
        if (cart.length === 0 && servicesProvided.length === 0) {
            return ValidationError.CartAndServicesEmpty;
        }
        if (!employeeid || typeof employeeid !== "number") {
            return ValidationError.InvalidEmployeeId;
        }
        if (!branchid || typeof branchid !== "number") {
            return ValidationError.InvalidBranchId;
        }
        if (typeof amountPayable !== "number" || typeof paid !== "number") {
            return ValidationError.InvalidAmounts;
        }
        if (!patientId || typeof patientId !== "number") {
            return ValidationError.InvalidPatientId;
        }
        if (!(await BillingSharedRepo.checkPatientIdExist(patientId, tenantId))) {
            return ValidationError.PatientDoesNotExist;
        }
        if (isPromo && (!promo || !promo.code)) {
            return ValidationError.PromoCodeRequired;
        }
        if (payments && Array.isArray(payments)) {
            for (const payment of payments) {
                if (!payment.mode || !(await BillingSharedRepo.validatePaymentModeId(parseInt(payment.mode.toString(), 10), tenantId))) {
                    return ValidationError.InvalidPaymentMode;
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
        taxList: any = null,
        trx?: any,
        hasRelatedBilling?: boolean,
        relatedBillingId?: number
    ): Promise<any[]> {
        let entityType: string = "general";
        let entityId: number = 0;
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        let registrationType: string = "self";
        if (billingData.billingSource > 1 && billingData.billingSource != 4 && billingData.entityId) {
            entityId = parseInt(billingData.entityId.toString());
            switch (billingData.billingSource) {
                case 2:
                    entityType = "organization";
                    organizationId = entityId;
                    registrationType = "organization";
                    break;
                case 3:
                    entityType = "phis";
                    insuranceId = entityId;
                    registrationType = "phis";
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
        } else if (billingData.billingSource === 4) {
            entityType = "nhis";
            registrationType = "nhis";
        }

        const result = await Promise.all(
            billingData.cart.map(async (item: BillingTestItem) => {
                const { paidamount, paymentstatus, outstanding } = SubmitCustomerBilling.getPaidAmountAndStatus(item);


                const newClinicianId = SubmitCustomerBilling.extractClinician(billingData);
                const newOrganizationId = SubmitCustomerBilling.extractOrganization(billingData);

                const source = billingData.billingSource as number;
                const userAdjustedValue = item?.userAdjustedValue ? parseFloat(item.userAdjustedValue?.toString() || "0") : null;
                const userAdjustmentType = item?.userAdjustmentType || null;
                const pricedToBeUsed = billingData.isPackageUsed ? item.cost || item.discountedValue: item.actualPrice;

                const data = {
                    billingid: billingID,
                    trackId: item.testid,
                    cost: pricedToBeUsed,
                    employeeid: billingData.employeeid,
                    serviceCategory: serviceCategory[source],
                    categoryTrackId: billingData.billingSource,
                    clinicianId: newClinicianId || null,
                    organizationId: newOrganizationId || null,
                    registrationType,
                    relatedbillingid: hasRelatedBilling ? relatedBillingId : null,
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
                    outstanding,
                    isPackageUsed: billingData.isPackageUsed ? 1 : 0,
                    packageid: billingData.packageid || null,
                    paidamount,
                    paymentstatus: paymentstatus,
                    nhismembershipid: billingData.nhismembershipid ? billingData.nhismembershipid : null,
                    claimscheckcode: billingData.claimscheckcode ? billingData.claimscheckcode : null,
                    userAdjustedValue,
                    userAdjustmentType
                }

                if (item.isoutsourced == 1 && item.outsourceid) {
                    const result = await trx('outsourceorganizationservices')
                        .where({ outsourceid: data.outsourceid, generalTestId: item.testid })
                        .first();
                    if (!result) {
                        throw new Error("Invalid outsource organization");
                    }
                    data['outsourceprice'] = result.outsourcePrice
                }
                return data;
            })
        );

        return result;
    }

    private static extractClinician(billingData: MultiTBillingDataShared) {
        if (!billingData) return null;
        if (billingData.entitytype == "clinician") return billingData.entityId || billingData.entityid;
        if (billingData.clinicianId && !isNaN(billingData.clinicianId)) return parseInt(billingData.clinicianId.toString());
    }

    private static extractOrganization(billingData: MultiTBillingDataShared) {
        if (!billingData) return null;
        if (billingData.entitytype == "organization") return billingData.entityId || billingData.entityid;
        if (billingData.organizationId && !isNaN(billingData.organizationId)) return parseInt(billingData.organizationId.toString());
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
        hasRelatedBilling?: boolean,
        relatedBillingId?: number
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
                insuranceId = entityId;
                registrationType = "insurance";
            case 4:
                insuranceId = entityId;
                registrationType = "nhis";
                break;
            case 6:
                clinicianId = entityId;
                registrationType = "clinician";
                break;
        }

        const { employeeid, branchid, taxIncluded, billingSource, isPackageUsed } = billingData;

        const outcome = await Promise.all(
            servicesProvided
                .map(async (item: any) => {
                    const { paidamount, paymentstatus, outstanding } = SubmitCustomerBilling.getPaidAmountAndStatus(item);

                    const newClinicianId = SubmitCustomerBilling.extractClinician(billingData);
                    const newOrganizationId = SubmitCustomerBilling.extractOrganization(billingData);
                    const userAdjustedValue = item?.userAdjustedValue ? parseFloat(item.userAdjustedValue?.toString() || "0") : null;
                    const userAdjustmentType = item?.userAdjustmentType || null;

                    return {
                        billingid: billingID,
                        trackId: item.keyid,
                        cost: item.servicePrice,
                        employeeid,
                        serviceCategory: serviceCategory[5],
                        categoryTrackId: 5,
                        clinicianId: newClinicianId,
                        organizationId: newOrganizationId,
                        registrationType,
                        branchid,
                        isoutsourced: 0,
                        outstanding,
                        outsourceid: 0,
                        outsourceprice: 0,
                        serviceAddedOn: new Date(),
                        taxList,
                        taxValue,
                        relatedbillingid: hasRelatedBilling ? relatedBillingId : null,
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
                        paymentstatus: paymentstatus,
                        paidamount: paidamount,
                        nhismembershipid: billingData.nhismembershipid ? billingData.nhismembershipid : null,
                        claimscheckcode: billingData.claimscheckcode ? billingData.claimscheckcode : null,
                        userAdjustedValue,
                        userAdjustmentType
                    };
                })
        );


        return outcome as ServiceEntry[];
    }

    public async loadMultipleServices(services: any[], billingid: number, tenantId: number, trx?: any) {
        const insertionErrors = [];
        const queryRunner = trx || await KnexConnection(tenantId);

        for (const item of services) {
            try {
                const [billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid, serviceAddedOn, taxList, taxValue, amountIncurredDueTax,
                    taxIncluded, discount, totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode, hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue, isPackageUsed, packageid] = item;
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
                    packageid,
                    nhismembershipid: item.nhismembershipid ? item.nhismembershipid : null,
                    claimscheckcode: item.claimscheckcode ? item.claimscheckcode : null,
                    relatedbillingid: item.relatedbillingid
                });

                if (isoutsourced && outsourceid) {
                    const outsourcedTestTrackingRepo = new OutsourcedTestTrackingRepo(tenantId);
                    await outsourcedTestTrackingRepo.create({
                        testid: trackId,
                        serviceid: outcome[0],
                        outsourceid,
                        employeeid,
                        status: 0,
                        comments: "New outsourced service added, waiting for dispatch",
                    }, queryRunner);


                }
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
                    service.packageid,
                    service.nhismembershipid ? service.nhismembershipid : null,
                    service.claimscheckcode ? service.claimscheckcode : null
                ];
            });

            const loadAllServices = await this.loadMultipleServices(servicesMap, billingid, tenantId, trx);


            return loadAllServices;
        } catch (err) {
            console.log('Error Loading services ',err)
            throw err;
        }
    }


    static async removePendingNonPaidServices({ tenantId, billingid, serviceid, employeeid }: {
        tenantId: number,
        billingid: number,
        serviceid: number,
        employeeid: number
    }): Promise<boolean | OperationsFailures[keyof OperationsFailures]> {
        const connection = await KnexConnection(tenantId);
        const overalBillRecord = await connection('billing').where({ billingid }).first();
        if (!overalBillRecord) return OperationsFailures.notFound

        let isParentBillingId = false;
        let workingBillinId = billingid;
        let isRelatedUsed = false;
        const transaction = await connection.transaction();
        try {
            const service = await transaction('dboservices')
                .where({ serviceid, billingid, paymentstatus: 'pending' })
                .first();
            if (!service) {
                return OperationsFailures.notFound;
            }

            const { paymentstatus, isDeleted, relatedbillingid } = service;


            if (relatedbillingid && !isNaN(relatedbillingid)) {
                isParentBillingId = true;
                workingBillinId = relatedbillingid;
                isRelatedUsed = true;
            }

            if (isDeleted === 1) {
                return OperationsFailures['serviceAlreadyDeleted'];
            }
            if (paymentstatus !== 'pending') {
                return OperationsFailures.serviceCannotBeRemoved;

            }
            const shallowDeleted = await transaction('dboservices')
                .where({ serviceid })
                .update({ 'isDeleted': 1, deletedAt: new Date(), isdeletedBy: employeeid });


            if (shallowDeleted) {
                const testAscensionDeletion = await transaction('test_ascension')
                    .where({ serviceid })
                    .del();

                if (!testAscensionDeletion) {
                    await transaction.rollback();
                    return OperationsFailures.internalServerError;
                }


                const overalBillRecord = await transaction('billing')
                    .where({ billingid: workingBillinId })
                    .first();


                if (!overalBillRecord) {
                    await transaction.rollback();
                    return OperationsFailures.notFound;
                }
                const newTotalCost = parseFloat(overalBillRecord.totalcost.toString()) - parseFloat(service.totalcost.toString());
                const newAmountPayable = parseFloat(overalBillRecord.payable.toString()) - parseFloat(service.totalpayable.toString());
                const newOutstanding = Math.max(newAmountPayable - overalBillRecord.paid, 0);
                const newBalance = newOutstanding > 0 ? 0 : overalBillRecord.paid - newAmountPayable;
                let newStatus = 'pending';
                if (overalBillRecord.paid >= newAmountPayable) {
                    newStatus = 'paid';
                }

                const updatedBillRecord = await transaction('billing')
                    .where({ billingid: workingBillinId })
                    .update({
                        totalcost: newTotalCost,
                        payable: newAmountPayable,
                        outstanding: newOutstanding,
                        balance: newBalance,
                        status: newStatus,
                        lastupdatedby: employeeid,
                    });

                if (isRelatedUsed && relatedbillingid && !isNaN(relatedbillingid)) {
                    await transaction('dboservices')
                        .update({ status: 'voided' })
                        .where({ relatedbillingid: workingBillinId, serviceid });
                } else {
                    await transaction('dboservices')
                        .update({ status: 'voided' })
                        .where({ billingid: workingBillinId, serviceid });
                }

                if (!updatedBillRecord) {
                    await transaction.rollback();
                    return OperationsFailures.internalServerError;
                }
                await transaction.commit();
                return true;
            } else {
                await transaction.rollback();
                return OperationsFailures.internalServerError;
            }

        } catch (err) {
            console.log('Error removing pending non paid service:', err);
            await transaction.rollback();
            return OperationsFailures.internalServerError;
        }
    }

}
