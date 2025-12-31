// import KnexConnection from "../../database/KnexConnections";
// import { BillingUpdateRepo } from "./billing_update";
// import { BillingSharedRepo } from "./billing_shared";
// import { CustomerBillingCheckout } from "./customerBillingCheckout";
// import { MultiTBillingDataShared } from "./multi/billing_shared_types";
// import { servicesProvided } from "./billingclientTypes";
// export class BillingUpdatingService {
//     /**
//      * Update a billing record, handling new/deleted/changed tests and services, and recalculating all summary fields.
//      */
//     static async updateClientBilling(
//         tenantId: number,
//         billingID: number,
//         newBillingData: MultiTBillingDataShared
//     ): Promise<{ status: boolean; message: string }> {
//         let trx: any;
//         try {
//             // --- VALIDATION BLOCK ---
//             // 1. Validate billing ID exists
//             const billingExists = await BillingSharedRepo.checkValidityOfBillingID(billingID, tenantId);
//             if (!billingExists) {
//                 return { status: false, message: "Invalid or non-existent billing ID." };
//             }
//             // 2. Validate request body structure and patient existence
//             const validBody = await BillingSharedRepo.validateBillingRequestBody(newBillingData, tenantId);
//             if (validBody !== true) {
//                 return { status: false, message: `Invalid billing update request: ${String(validBody)}` };
//             }
//             // --- END VALIDATION BLOCK ---
//             const db = await KnexConnection(tenantId);
//             trx = await db.transaction();
//             // 1. Load current tests/services for this billingID
//             const currentEntries = await trx("dboservices").where("billingid", billingID);
//             const currentTestIds = currentEntries.filter((e: any) => e.trackId && (!e.serviceCategory || e.serviceCategory !== "SERVICES")).map((e: any) => e.trackId);
//             const currentServiceIds = currentEntries.filter((e: any) => e.trackId && e.serviceCategory === "SERVICES").map((e: any) => e.trackId);
//             // 2. Determine new, deleted, and unchanged tests/services
//             const newTestIds = (newBillingData.cart || []).map((item: any) => item.testid);
//             const newServiceIds = (newBillingData.servicesProvided || []).map((item: any) => item.keyid);
//             const testsToAdd = (newBillingData.cart || []).filter((item: any) => !currentTestIds.includes(item.testid));
//             const testsToRemove = currentTestIds.filter((id: any) => !newTestIds.includes(id));
//             const servicesToAdd = (newBillingData.servicesProvided || []).filter((item: any) => !currentServiceIds.includes(item.keyid));
//             const servicesToRemove = currentServiceIds.filter((id: any) => !newServiceIds.includes(id));
//             // 3. Remove deleted tests/services
//             if (testsToRemove.length > 0) {
//                 await trx("dboservices").where("billingid", billingID).whereIn("trackId", testsToRemove).andWhere(function () { this.whereNull("serviceCategory").orWhereNot("serviceCategory", "SERVICES"); }).del();
//             }
//             if (servicesToRemove.length > 0) {
//                 await trx("dboservices").where("billingid", billingID).whereIn("trackId", servicesToRemove).andWhere("serviceCategory", "SERVICES").del();
//             }
//             // 4. Add new tests/services using instance methods
//             const Multi = new BillingSharedRepo();
//             if (testsToAdd.length > 0) {
//                 const testEntries = await BillingSharedRepo.processTestCart(
//                     tenantId,
//                     { ...newBillingData, cart: testsToAdd },
//                     billingID,
//                     newBillingData.taxValue,
//                     newBillingData.taxList || null,
//                     trx
//                 );
//                 await Multi.mapAndInsertServices(tenantId, testEntries, billingID, trx);
//             }
//             if (servicesToAdd.length > 0) {
//                 const mappedServicesToAdd: servicesProvided[] = servicesToAdd.map((item: any) => ({
//                     serviceName: item.serviceName || '',
//                     servicePrice: item.servicePrice || 0,
//                     discount: item.discount || 0,
//                     originalValue: item.originalValue || 0,
//                     totalcost: item.totalcost || 0,
//                     totalDiscount: item.totalDiscount || 0,
//                     payable: item.payable || 0,
//                     amountIncurredDueTax: item.amountIncurredDueTax || 0,
//                     totalServiceCost: item.totalServiceCost || 0,
//                     hasNightAdjustment: item.hasNightAdjustment || false,
//                     nightAdjustmentMode: item.nightAdjustmentMode || 'none',
//                     nightAdjustmentValue: item.nightAdjustmentValue || 0,
//                     isPackageUsed: item.isPackageUsed || false,
//                     packageid: item.packageid || null,
//                     keyid: item.keyid,
//                     discountedValue: item.discountedValue || 0,
//                 }));
//                 const serviceEntries = await BillingSharedRepo.processNonTestServices(
//                     newBillingData,
//                     mappedServicesToAdd as any,
//                     billingID,
//                     newBillingData.taxValue,
//                     newBillingData.taxList || null
//                 );
//                 await Multi.mapAndInsertServices(tenantId, serviceEntries, billingID, trx);
//             }
//             // 5. Recalculate all summary fields using the latest logic
//             const allDbEntries = await trx("dboservices").where("billingid", billingID);
//             const testDbEntries = allDbEntries.filter((e: any) => !e.serviceCategory || e.serviceCategory !== "SERVICES");
//             const serviceDbEntries = allDbEntries.filter((e: any) => e.serviceCategory === "SERVICES");
//             // 6. Update billing record
//             const updateData = {
//                 totalTransactionCost: billingFinalValues.totalcost,
//                 totalcost: billingFinalValues.totalcost,
//                 paid: newBillingData.paid,
//                 payable: billingFinalValues.payable,
//                 discount: billingFinalValues.totalDiscount,
//                 amountIncurredDueTax: billingFinalValues.amountIncurredDueTax,
//                 outstanding: billingFinalValues.outstanding,
//                 balance: billingFinalValues.balance,
//                 totalrefunded: 0,
//                 lastUpdated: new Date(), // Track when the update occurred
//                 updatedBy: newBillingData.employeeid || null // Track who performed the update
//             };
//             const result = await trx("billing").where("billingid", billingID).update(updateData);
//             if (!result) throw new Error("unable to update billing record");
//             // 7. Insert billing history for each payment (if payments array exists)
//             if (Array.isArray(newBillingData.payments) && newBillingData.payments.length > 0) {
//                 for (const payment of newBillingData.payments) {
//                     const paymentMode = payment.mode;
//                     const paymentAmount = payment.amount;
//                     const employeeId = payment.employeeid || newBillingData.employeeid;
//                     if (!paymentMode || !employeeId) {
//                         throw new Error("Missing mode or employeeid in payment record.");
//                     }
//                     await BillingSharedRepo.insertBillHistory(
//                         trx,
//                         billingID,
//                         paymentMode,
//                         paymentAmount,
//                         employeeId,
//                         "credit"
//                     );
//                 }
//             } else {
//                 // Fallback: single payment
//                 await BillingSharedRepo.insertBillHistory(
//                     trx,
//                     billingID,
//                     newBillingData.paymentmode,
//                     newBillingData.paid,
//                     newBillingData.employeeid,
//                     "credit"
//                 );
//             }
//             await trx.commit();
//             return { status: true, message: "Billing updated successfully" };
//         } catch (error: any) {
//             if (trx) await trx.rollback();
//             return { status: false, message: error && error.message ? error.message : "Unknown error in billing update" };
//         }
//     }
// }
