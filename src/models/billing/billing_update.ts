import KnexConnection from "../../database/KnexConnections";
import { BillingSharedRepo } from "./billing_shared";
import { MultiTBillingDataShared } from "./multi/billing_shared_types";

export class BillingUpdateRepo {
    static async updateBillingTransaction(
        tenantId: number,
        billingID: number,
        billingData: MultiTBillingDataShared
    ): Promise<void> {
        const cart = billingData.cart;
        const servicesProvidedArr = billingData.servicesProvided;

        // 1. Check for valid billing ID
        const valid = await BillingSharedRepo.checkValidityOfBillingID(billingID, tenantId);
        if (!valid) throw new Error("billingid not provided, invalid, or not found");

        // 2. Validate billing request body
        const validBody = await BillingSharedRepo.validateBillingRequestBody(billingData, tenantId);
        if (validBody !== true) throw new Error(String(validBody));

        // 3. Check cart and servicesProvided arrays
        if (!cart || !servicesProvidedArr || (cart.length === 0 && servicesProvidedArr.length === 0)) {
            throw new Error("invalid response body params: cart and servicesProvided must not both be empty");
        }

        // Remove duplicates
        const testCart = await BillingSharedRepo.removeDuplicateServiceFromNewCart(
            cart,
            billingData.billingSource,
            billingID,
            true,
            tenantId
        );
        const testServices = await BillingSharedRepo.removeDuplicateServiceFromNewCart(
            servicesProvidedArr,
            billingData.billingSource,
            billingID,
            false,
            tenantId
        );

        if (testCart.length !== cart.length || testServices.length !== servicesProvidedArr.length) {
            throw new Error("some requested services already exist for this transaction");
        }
        if (testCart.length === 0 && testServices.length === 0) {
            throw new Error("all requested services already exist for this transaction");
        }

        const db = await KnexConnection(tenantId);
        let trx: any;
        try {
            trx = await db.transaction();
            // Adjust and process test cart
            const testEntries = await BillingSharedRepo.processTestCart(
                tenantId,
                billingData,
                billingID,
                billingData.taxValue,
                billingData.taxList || null,
                trx
            );

            // Adjust and process non-test services
            const Multi = new BillingSharedRepo();
            const adjustedTestServices = await Multi.verificationOfServicesAndNightAdjustment(
                tenantId,
                testServices,
                5,
                billingData.taxValue,
                billingData.isPackageUsed
            );
            const serviceEntries = await BillingSharedRepo.processNonTestServices(
                billingData,
                adjustedTestServices as any,
                billingID,
                billingData.taxValue,
                billingData.taxList || null
            );

            // Insert all entries
            const allEntries = [...testEntries, ...serviceEntries];
            if (allEntries.length > 0) {
                const loadAllServices = await Multi.mapAndInsertServices(
                    tenantId,
                    allEntries,
                    billingID,
                    billingData.patientid,
                    billingData.result_delivery,
                    trx
                );
                if (loadAllServices.length > 0) {
                    throw new Error("Unable to load services");
                }
            }

            // Update billing record (recalculate totals)
            const allDbEntries = await trx("dboservices").where("billingid", billingID);
            const testDbEntries = allDbEntries.filter((e: any) => !e.serviceCategory || e.serviceCategory !== "SERVICES");
            const serviceDbEntries = allDbEntries.filter((e: any) => e.serviceCategory === "SERVICES");
            // Use shared helper for calculation
            const billingFinalValues = BillingSharedRepo.calculateBillingVariablesFinal(
                serviceDbEntries,
                testDbEntries,
                billingData.paid
            );

            const updateData = {
                totalTransactionCost: billingFinalValues.totalcost,
                totalcost: billingFinalValues.totalcost,
                paid: billingData.paid,
                payable: billingFinalValues.payable,
                discount: billingFinalValues.totalDiscount,
                amountIncurredDueTax: billingFinalValues.amountIncurredDueTax,
                outstanding: billingFinalValues.outstanding,
                balance: billingFinalValues.balance,
                totalrefunded: 0,
            };
            const result = await trx("billing").where("billingid", billingID).update(updateData);
            if (!result) throw new Error("unable to update billing record");

            // Insert billing history
            await BillingSharedRepo.insertBillHistory(
                tenantId,
                trx,
                billingID,
                billingData.paymentmode,
                billingData.paid,
                billingData.employeeid,
                "credit"
            );
            await trx.commit();
        } catch (error) {
            if (trx) {
                await trx.rollback();
            }
            throw error;
        }
    }
}
