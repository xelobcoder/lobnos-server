import { EntityType } from "./billing_shared_types";
import KnexConnection from "../../database/KnexConnections";
import { ReferralCodingRepo } from "../referral/repositories/ReferralCodingRepo";

/**
 * Submits the finalized billing information to the database.
 * If a referral code was used, updates entityId and entityType accordingly.
 */
export async function submitCustomerBilling({
    tenantId,
    patientId,
    billingid,
    cart,
    servicesList,
    paymentDetails,
    branchid,
    billingSource,
    referalCode,
    promoCode,
    isPromo,
    isPackageUsed,
    packageid
}: {
    tenantId: number;
    patientId: number;
    billingid?: number;
    cart: any[];
    servicesList?: any[];
    paymentDetails: any;
    branchid: number;
    billingSource: number;
    referalCode?: number;
    promoCode?: string;
    isPromo?: boolean;
    isPackageUsed?: boolean;
    packageid?: number;
}): Promise<{ success: boolean; message: string; billingid?: number }> {
    if (!patientId) return { success: false, message: 'No patientId provided' };
    if (!branchid) return { success: false, message: 'No branchid provided' };
    if (!billingSource) return { success: false, message: 'No billingSource provided' };
    if (
        (!cart || !Array.isArray(cart) || cart.length === 0) &&
        (!servicesList || !Array.isArray(servicesList) || servicesList.length === 0)
    ) {
        return { success: false, message: 'Cart and servicesList are both empty' };
    }

    // If referral code is used, update entityId and entityType
    let entityId: number | null = null;
    let entityType: EntityType = 'general' as EntityType;
    if (referalCode) {
        const referalRepo = await new ReferralCodingRepo(tenantId).findByCode(parseInt(referalCode.toString(), 10));
        if (referalRepo) {
            entityType = referalRepo.entity_type;
            entityId = referalRepo.entity_id;
        }
    }

    // Prepare billing data
    const conn = await KnexConnection(tenantId);
    const now = new Date();
    const billingData: any = {
        patientid: patientId,
        branchid,
        billingSource,
        entityid: entityId,
        entitytype: entityType,
        referalCode,
        promoCode,
        isPromo: !!isPromo,
        isPackageUsed: !!isPackageUsed,
        packageid,
        created_at: now,
        updated_at: now,
        paid: paymentDetails?.amount || 0,
        paymentStatus: 'pending',
        // Add more fields as needed
    };

    try {
        // Insert billing record
        const [newBillingId] = await conn('billing').insert(billingData).returning('billingid');
        // Insert cart items as dboservices
        if (cart && cart.length > 0) {
            const serviceRows = cart.map((item: any) => ({
                billingid: newBillingId,
                patientid: patientId,
                testid: item.testid,
                price: item.price,
                discount: item.discount,
                discountedValue: item.discountedValue,
                created_at: now,
                updated_at: now
            }));
            await conn('dboservices').insert(serviceRows);
        }
        // Insert servicesList items as services_billed (if table exists)
        if (servicesList && servicesList.length > 0) {
            const serviceRows = servicesList.map((item: any) => ({
                billingid: newBillingId,
                patientid: patientId,
                serviceid: item.id ?? item.keyid,
                servicePrice: item.servicePrice,
                discount: item.discount,
                discountedValue: item.discountedValue,
                created_at: now,
                updated_at: now
            }));
            // If you have a table for billed services, insert here (e.g., 'services_billed')
            // await conn('services_billed').insert(serviceRows);
        }
        // Insert payment history
        if (paymentDetails && paymentDetails.amount) {
            await conn('billinghx').insert({
                billingid: newBillingId,
                patientid: patientId,
                amount: paymentDetails.amount,
                paymentDate: now,
                paymentMode: paymentDetails.paymentMode || null,
                created_at: now
            });
        }
        return { success: true, message: 'Billing submitted successfully', billingid: newBillingId };
    } catch (error: any) {
        return { success: false, message: 'Error submitting billing: ' + error.message };
    }
}
