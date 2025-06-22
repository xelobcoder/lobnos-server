import { Knex } from "knex";
import { SalesSessionRepo } from "./repositories/SalesSessionRepo";
import { BillErrors, MultiTBillingDataShared } from "./billing_shared_types";
import { BillingSharedRepo } from "./billing_shared";
import KnexConnection from "../../database/KnexConnections";
import { PrimeBillingPromoCodeRepo } from "./repositories/PrimeBillingPromoCodeRepo";

/**
 * ENFORCEMENT: Only 'paid', 'category', and 'billingsource' (if present) are accepted from the frontend.
 * All other finance-related fields (totals, discounts, promo, payable, outstanding, etc.) are strictly calculated and verified on the backend.
 * If future fields are added, ensure they are not accepted from the frontend unless explicitly allowed.
 */
export class MultiBillingRepo {
    tenantId: number;
    connection: any;
    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    public async billNewTransaction(
        billingData: MultiTBillingDataShared
    ): Promise<number | string> {
        let trx: Knex.Transaction | undefined;
        try {
            let billingID: number;

            // 1. Check for active session
            const sessionRepo = new SalesSessionRepo(this.tenantId);
            const today = (new Date() as unknown) as string;
            const sessionExists = await sessionRepo.hasActiveSessionForDate(
                today,
                billingData.samplingCenter
            );
            if (!sessionExists) {
                return BillErrors.NoBillingSession;
            }

            const valid = await BillingSharedRepo.validateBillingRequestBody(
                billingData,
                this.tenantId
            );
            if (valid !== true) throw new Error(String(valid));

            const taxValue = billingData.taxValue;
            const taxList = billingData.taxList || null;

            const conn = await this.connection;
            trx = await conn.transaction();
            // Generate billing ID inside transaction
            billingID = await BillingSharedRepo.generateBillingID(
                billingData.patientid,
                this.tenantId,
                trx
            );

            // Insert test cart
            const testResult = await BillingSharedRepo.processTestCart(
                this.tenantId,
                billingData,
                billingID,
                taxValue,
                taxList,
                trx
            );
            // Insert non-test services
            const Multi = new BillingSharedRepo();
            const serviceProvided = await Multi.verificationOfServicesAndNightAdjustment(
                this.tenantId,
                billingData.servicesProvided,
                5,
                taxValue,
                billingData.isPackageUsed
            );
            const serviceEntries = await BillingSharedRepo.processNonTestServices(
                billingData,
                serviceProvided as any,
                billingID,
                taxValue,
                taxList
            );

            const allEntries = [...testResult, ...serviceEntries];

            if (allEntries.length > 0) {
                // ENFORCEMENT: Each item totalcost is after night adjustment and item discount, but before promo. Tax is calculated per item and summed.
                const billing_final_values = BillingSharedRepo.calculateBillingVariablesFinal(
                    serviceEntries,
                    testResult,
                    billingData.paid)



                const loadAllServices = await new BillingSharedRepo()
                    .mapAndInsertServices(this.tenantId, allEntries, billingID, trx);

                if (loadAllServices.length > 0) {
                    throw new Error(BillErrors.UnableToLoadServices);
                }

                // Prepare update data
                // Use shared function to apply promo to payable
                let promoValue = 0;
                let promoMethod = null;
                let promoCodeId = null;
                let payableAfterPromo = billing_final_values.payable;
                if (billingData.isPromo && billingData.promo && billingData.promo.id && billingData.promoMethod && billingData.promo.discount_value) {
                    const promoAmount = Number(billingData.promo.discount_value);
                    const { promoValue: calcPromoValue, amountAfterPromo } = BillingSharedRepo.applyPromoCodeToAmount(
                        billing_final_values.payable,
                        billingData.promoMethod,
                        promoAmount
                    );
                    promoValue = Number(calcPromoValue) || 0;
                    payableAfterPromo = Number(amountAfterPromo) || billing_final_values.payable;
                    promoMethod = billingData.promoMethod;
                    promoCodeId = billingData.promo.id;
                }

                const updateData = {
                    totalTransactionCost: billing_final_values.totalcost,
                    totalcost: billing_final_values.totalcost,
                    paid: billingData.paid,
                    payable: payableAfterPromo,
                    discount: billing_final_values.totalDiscount,
                    amountIncurredDueTax: billing_final_values.amountIncurredDueTax,
                    outstanding: Number((payableAfterPromo - billingData.paid).toFixed(2)),
                    totalrefunded: 0,
                    isPromo: billingData.isPromo || false,
                    promoValue: promoValue,
                    promoMethod: promoMethod,
                    promoCodeId: promoCodeId,
                }


                const result = await trx("billing")
                    .where("billingid", billingID)
                    .update(updateData);

                if (!result) throw new Error("unable to update billing record");

                // Increment promo usage if promo applied
                if (billingData.isPromo && billingData.promo && billingData.promo.id) {
                    const promoRepo = new PrimeBillingPromoCodeRepo(this.tenantId);
                    await promoRepo.incrementUsage(billingData.promo.id, trx);
                }

                await BillingSharedRepo.insertBillHistory(
                    trx,
                    billingID,
                    billingData.paymentmode,
                    billingData.paid,
                    billingData.employeeid,
                    "credit"
                );
                await trx.commit();
            }
            return billingID;
        } catch (error) {
            if (trx) {
                await trx.rollback();
            }
            console.error("Error in billNewTransaction:", error);
            return BillErrors.Error;
        }
    }


    public async billNewTransactionSimpleApproach(
        billingData: MultiTBillingDataShared
    ): Promise<number | string> {
        let trx: Knex.Transaction | undefined;
        try {
            let billingID: number;

            // 1. Check for active session
            const sessionRepo = new SalesSessionRepo(this.tenantId);
            const today = (new Date() as unknown) as string;
            const sessionExists = await sessionRepo.hasActiveSessionForDate(
                today,
                billingData.samplingCenter
            );
            if (!sessionExists) {
                return BillErrors.NoBillingSession;
            }

            const valid = await BillingSharedRepo.validateBillingRequestBody(
                billingData,
                this.tenantId
            );
            if (valid !== true) throw new Error(String(valid));

            const taxValue = billingData.taxValue;
            const taxList = billingData.taxList || null;

            const conn = await this.connection;
            trx = await conn.transaction();
            // Generate billing ID inside transaction
            billingID = await BillingSharedRepo.generateBillingID(
                billingData.patientid,
                this.tenantId,
                trx
            );

            console.log("billingID", billingID);
         

            // Insert test cart
        } catch (error) {
            if (trx) {
                await trx.rollback();
            }
            console.error("Error in billNewTransactionSimpleApproach:", error);
            return BillErrors.Error;
        }
    }



}


// STEPS 
// 1. check if patient have pending  yet to be settled 
// 2. check if active sales session exists for today
// 3. receive the entity type and entity id and if it ia package 
// if no package  chek if billing trategy exists for the entity, if no fall baxck on the general test
// 4. if package send package information and proceed to checkout for payment
// if no package, if night adjustment is enabled, check if night adjustment is applicable
// 5. if night adjustment is applicable, apply night adjustment  and send to frontend for test selection