import { EntityType } from "./billing_shared_types";
import { ApplicationSettingsData, AppSetting } from "../application/appsettings/Type";
import { PrimeBillingPromoCodeRepo } from "./repositories/PrimeBillingPromoCodeRepo";
import { PackageBillingHelper } from "./packageBillingHelper";
import { PrimeBillingEnterprise } from "./PrimeBillingEnterprise";

class CustomerBillingCheckoutSingleton extends PrimeBillingEnterprise {
     static instance: CustomerBillingCheckoutSingleton;
     private constructor(tenantId: number) {
          super(tenantId);
     }
     static getInstance(tenantId: number) {
          if (!CustomerBillingCheckoutSingleton.instance || CustomerBillingCheckoutSingleton.instance.tenantId !== tenantId) {
               CustomerBillingCheckoutSingleton.instance = new CustomerBillingCheckoutSingleton(tenantId);
          }
          return CustomerBillingCheckoutSingleton.instance;
     }
     static async checkoutCustomerBilling({
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
          packageid,
          tenantId
     }: {
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
          tenantId: number;
     }): Promise<{ success: boolean; message: string; data?: any }> {
          const billing = CustomerBillingCheckoutSingleton.getInstance(tenantId);
          // --- VALIDATION ---
          if (!patientId) return { success: false, message: 'No patientId provided' };
          if (branchid === undefined || branchid === null) return { success: false, message: 'No branchid provided' };
          if (billingSource === undefined || billingSource === null) return { success: false, message: 'No billingSource provided' };

          // Validate outstanding debt
          const totalOutstanding = await billing.getCustomerOutstandingDebt(patientId);
          if (totalOutstanding > 0) return { success: false, message: 'Outstanding debt found' };

          // Get app settings for recalculation
          const appsettings: ApplicationSettingsData | null = await billing.getAppSettings();
          const { includeTax, billingsettings } = appsettings || {};
          const taxation: Partial<AppSetting> = appsettings ? await billing.getAppBillSettings() : {};

          let recalculatedCart: any[] = [];
          let recalculatedPackageList: any[] = [];
          let usedPackage = false;
          let taxIncluded = false;
          let taxList: any = undefined;
          let taxValue: number | undefined = undefined;

          // --- PROMO CODE VALIDATION ---
          let promoDiscount = 0;
          let promoValid = false;
          let promoDetails: any = null;
          if (isPromo && promoCode) {
               const promoRepo = new PrimeBillingPromoCodeRepo(tenantId);
               const promoResult = await promoRepo.validatePromoCode(promoCode);
               promoValid = promoResult.valid;
               promoDetails = promoResult.promo;
               if (!promoValid) {
                    return { success: false, message: promoResult.reason || 'Invalid promo code', data: { promoCode } };
               }
          }

          // --- ALWAYS FETCH ORIGINAL DATA FOR TESTS/SERVICES ---
          if (isPackageUsed && packageid) {
               const pkgResult = await PackageBillingHelper.handlePackageCheckout({
                    tenantId: tenantId,
                    packageid,
                    cart
               });
               if (!pkgResult.success) return { success: false, message: pkgResult.message };
               recalculatedPackageList = pkgResult.recalculatedPackageList || [];
               usedPackage = true;
          } else {
               const selectedTestIds = cart.map(item => item.testid);
               let allTests: any[] = [];
               if (selectedTestIds.length > 0) {
                    let entityType: EntityType = 'general' as EntityType;
                    let entityId = null;
                    if (referalCode) {
                         const referalRepo = await billing.getReferralByCode(referalCode);
                         if (referalRepo) {
                              entityType = referalRepo.entity_type;
                              entityId = referalRepo.entity_id;
                         }
                    }
                    allTests = await billing.getBillingHandler(entityType, entityId);
               }
               recalculatedCart = allTests
                    .filter(test => selectedTestIds.includes(test.testid))
                    .map(test => ({
                         ...test,
                         price: test.price,
                         discount: test.discount || 0
                    }));

               if (billingsettings && billingsettings.hasNightAdjustment) {
                    recalculatedCart = PrimeBillingEnterprise.applyNightAdjustmentsToTests(recalculatedCart, billingsettings, 'test');
               }

               // Discount
               recalculatedCart = PrimeBillingEnterprise.applyDiscountsToTests(recalculatedCart);
               // Promo
               if (isPromo && promoValid && promoCode && promoDetails) {
                    recalculatedCart = PrimeBillingEnterprise.applyPromoToItems(recalculatedCart, { type: promoDetails.discount_type, value: promoDetails.discount_value });
               }
               // Tax
               if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                    recalculatedCart = PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, taxation.taxValue);
                    taxIncluded = true;
                    taxList = taxation;
               }
               recalculatedCart = PrimeBillingEnterprise.addNightAdjustmentInfo(recalculatedCart, billingsettings);
          }

          let recalculatedServicesList: any[] = await CustomerBillingCheckoutSingleton.recalculateServicesList({
               billing,
               servicesList,
               billingsettings,
               isPromo,
               promoValid,
               promoCode,
               promoDetails,
               includeTax,
               taxation
          });

          const {
               subtotal,
               totaldiscount,
               totalAmountIncurredDueTax,
               totalServiceAmount
          } = PrimeBillingEnterprise.calculateBillingTotals({
               usedPackage,
               recalculatedPackageList,
               recalculatedCart,
               recalculatedServicesList
          });

          if (isPromo && promoValid && promoCode && promoDetails) {
               promoDiscount = PrimeBillingEnterprise.calculatePromoDiscount(subtotal, promoDetails);
          }

          const paid = paymentDetails && paymentDetails.amount ? paymentDetails.amount : 0;
          const amountPayable = subtotal + totalAmountIncurredDueTax;
          const balance = amountPayable - paid;

          return {
               success: true,
               message: 'Checkout recalculation successful. No payment has been received yet.',
               data: {
                    subtotal,
                    totaldiscount,
                    totalAmountIncurredDueTax,
                    totalServiceAmount,
                    amountPayable,
                    paid,
                    balance,
                    cart: recalculatedCart,
                    servicesList: recalculatedServicesList,
                    promoCode: promoCode || undefined,
                    promoDiscount,
                    isPromo: !!isPromo,
                    isPackageUsed: !!isPackageUsed,
                    packageid: packageid || undefined,
                    packageTestList: usedPackage ? recalculatedPackageList : undefined,
                    promoDetails: promoValid ? promoDetails : undefined,
                    paymentStatus: 'pending',
                    paymentReceived: false,
                    taxIncluded,
                    taxList
               }
          };
     }
     static async recalculateServicesList(params: any): Promise<any[]> {
          return PrimeBillingEnterprise.recalculateServicesList(params);
     }
}

export const CustomerBillingCheckout = CustomerBillingCheckoutSingleton;
