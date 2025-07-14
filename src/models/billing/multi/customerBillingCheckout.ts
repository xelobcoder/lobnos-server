import { ApplicationSettingsData, AppSetting } from "../../application/appsettings/Type";
import { PrimeBillingPromoCodeRepo } from "../repositories/PrimeBillingPromoCodeRepo";
import { EntityType } from "./billing_shared_types";
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
     static async checkoutCustomerBilling(params: any): Promise<{ success: boolean; message: string; data?: any }> {
          const billing = CustomerBillingCheckoutSingleton.getInstance(params.tenantId);
          return billing.handleCheckout(params);
     }
     private async handleCheckout({
          patientId,
          billingid,
          cart,
          servicesList,
          paymentDetails,
          branchid,
          billingSource,
          referalCode,
          promoCode,
          ispricingcheckout,
          isPromo,
          isPackageUsed,
          packageid,
          entitytype,
          entityid,
          tenantId
     }: any): Promise<{ success: boolean; message: string; data?: any }> {
          if (!patientId && !ispricingcheckout) return { success: false, message: 'No patientId provided' };
          if (branchid === undefined || branchid === null) return { success: false, message: 'No branchid provided' };
          if (billingSource === undefined || billingSource === null) return { success: false, message: 'No billingSource provided' };

          let previousBilling = null;
          let previousServices = null;
          if (billingid) {
               const conn = await this.connection;
               previousBilling = await this.previousBillingSummary(billingid);
               previousServices = await conn('dboservices').where('billingid', billingid).select();
          }

          const totalOutstanding = await this.getCustomerOutstandingDebt(patientId);
          if (totalOutstanding > 0) return { success: false, message: 'Outstanding debt found' };

          const appsettings: ApplicationSettingsData | null = await this.getAppSettings();
          const { includeTax, billingsettings } = appsettings || {};
          const taxation: Partial<AppSetting> = appsettings ? await this.getAppBillSettings() : {};

          let recalculatedCart: any[] = [];
          let recalculatedPackageList: any[] = [];
          let usedPackage = false;
          let taxIncluded = false;
          let taxList: any = undefined;

          let promoDiscount = 0;
          let promoValid = false;
          let promoDetails: any = null;
          if (isPromo && promoCode) {
               const promoResult = await this.validatePromo(tenantId, promoCode);
               promoValid = promoResult.valid;
               promoDetails = promoResult.promo;
               if (!promoValid) {
                    return { success: false, message: promoResult.reason || 'Invalid promo code', data: { promoCode } };
               }
          }

          if (isPackageUsed && packageid) {
               const pkgResult = await PackageBillingHelper.handlePackageCheckout({
                    tenantId,
                    packageid
               });
               if (!pkgResult.success) return { success: false, message: pkgResult.message };
               recalculatedPackageList = pkgResult.recalculatedPackageList || [];
               usedPackage = true;
          } else {
               recalculatedCart = await this.getRecalculatedCart(cart, referalCode, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation, entitytype, entityid);
          }

          let recalculatedServicesList: any[] = await CustomerBillingCheckoutSingleton.recalculateServicesList({
               billing: this,
               servicesList,
               billingsettings,
               isPromo,
               promoValid,
               promoCode,
               promoDetails,
               includeTax,
               taxation,
               entityid,
               entitytype
          });

          const {
               subtotal,
               totaldiscount,
               totalpayable,
               totalAmountIncurredDueTax,
               totalServiceAmount
          } = PrimeBillingEnterprise.calculateBillingTotals({
               usedPackage,
               recalculatedPackageList,
               recalculatedCart,
               recalculatedServicesList
          });


          const toFixed2 = (num: number) => Number(num.toFixed(2));
          const paid = toFixed2(paymentDetails && paymentDetails.amount ? paymentDetails.amount : 0);
          const totalTestAmountPayable = toFixed2(recalculatedCart.reduce((sum, item) => sum + (item.totalpayable || 0), 0));
          const totalServiceAmountPayable = toFixed2(recalculatedServicesList.reduce((sum, item) => sum + (item.totalpayable || 0), 0));
          const amountPayable = toFixed2(totalpayable)
          const outstanding = toFixed2(amountPayable - paid);
          const balance = paid > amountPayable ? toFixed2(paid - amountPayable) : 0;

          if (balance < 0) {
               return { success: false, message: 'Paid amount exceeds total payable amount', data: { balance } };
          }

          return {
               success: true,
               message: 'Checkout recalculation successful. No payment has been received yet.',
               data: {
                    subtotal: toFixed2(subtotal),
                    totalcost: amountPayable,
                    totaldiscount: toFixed2(totaldiscount),
                    totalAmountIncurredDueTax: toFixed2(totalAmountIncurredDueTax),
                    totalServiceAmount: toFixed2(totalServiceAmount),
                    amountPayable,
                    outstanding,
                    totalTestAmountPayable,
                    totalServiceAmountPayable,
                    paid,
                    balance,
                    cart: recalculatedCart.map(item => ({ ...item, totalpayable: toFixed2(item.totalpayable), totalcost: toFixed2(item.totalcost), discountedValue: toFixed2(item.discountedValue), amountIncurredDueTax: toFixed2(item.amountIncurredDueTax), price: toFixed2(item.price), actualPrice: toFixed2(item.actualPrice), originalPrice: toFixed2(item.originalPrice), entitytype: item.entitytype || entitytype, entityId: item.entityId || entityid })),
                    servicesList: recalculatedServicesList.map(item => ({ ...item, totalpayable: toFixed2(item.totalpayable), totalcost: toFixed2(item.totalcost), discountedValue: toFixed2(item.discountedValue), amountIncurredDueTax: toFixed2(item.amountIncurredDueTax), servicePrice: toFixed2(item.servicePrice), entitytype: item.entitytype || entitytype, entityId: item.entityId || entityid })),
                    promoCode: promoCode || undefined,
                    promoDiscount: toFixed2(promoDiscount),
                    isPromo: !!isPromo,
                    isPackageUsed: !!isPackageUsed,
                    packageid: packageid || undefined,
                    packageTestList: usedPackage ? recalculatedPackageList : undefined,
                    promoDetails: promoValid ? promoDetails : undefined,
                    paymentStatus: 'pending',
                    paymentReceived: false,
                    taxIncluded,
                    taxList,
                    entitytype,
                    entityId: entityid,
                    ispricingcheckout,
                    entityid,
                    previousBilling,
                    previousServices
               }
          };
     }
     private async getRecalculatedCart(cart: any[], referalCode: any, billingsettings: any, isPromo: boolean, promoValid: boolean, promoCode: string, promoDetails: any, includeTax: any, taxation: any, entitytype?: any, entityId?: any): Promise<any[]> {
          const selectedTestIds = cart.map((item: any) => item.testid);

          let allTests: any[] = [];
          if (selectedTestIds.length > 0) {
               let entityType: EntityType = entitytype || ('general' as EntityType);
               let entityIdValue = entityId || null;
               if (referalCode) {
                    const referalRepo = await this.getReferralByCode(referalCode);
                    if (referalRepo) {
                         entityType = referalRepo.entity_type;
                         entityIdValue = referalRepo.entity_id;
                    }
               }
               allTests = await this.getBillingHandler(entityType, entityIdValue);
          }
          let recalculatedCart = allTests
               .filter((test: any) => selectedTestIds.includes(test.testid))
               .map((test: any) => ({
                    ...test,
                    price: test.price,
                    discount: test.discount || 0
               }));
          recalculatedCart = this.applyAllBillingRulesToCart(recalculatedCart, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation);
          return recalculatedCart;
     }
     private applyAllBillingRulesToCart(recalculatedCart: any[], billingsettings: any, isPromo: boolean, promoValid: boolean, promoCode: string, promoDetails: any, includeTax: any, taxation: any): any[] {
          if (billingsettings && billingsettings.hasNightAdjustment) {
               recalculatedCart = PrimeBillingEnterprise.applyNightAdjustmentsToTests(recalculatedCart, billingsettings, 'test');
          }

          if (isPromo && promoValid && promoCode && promoDetails) {
               recalculatedCart = PrimeBillingEnterprise.applyPromoToItems(recalculatedCart, { type: promoDetails.discount_type, value: promoDetails.discount_value });
          } else {
               recalculatedCart = PrimeBillingEnterprise.applyDiscountsToTests(recalculatedCart);
          }
          if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
               recalculatedCart = PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, taxation.taxValue);
          }
          recalculatedCart = PrimeBillingEnterprise.addNightAdjustmentInfo(recalculatedCart, billingsettings);
          return recalculatedCart;
     }
     static async recalculateServicesList(params: any): Promise<any[]> {
          return PrimeBillingEnterprise.recalculateServicesList(params);
     }
     private async validatePromo(tenantId: number, promoCode: string): Promise<{ valid: boolean, promo: any, reason?: string }> {
          const promoRepo = new PrimeBillingPromoCodeRepo(tenantId);
          const promoResult = await promoRepo.validatePromoCode(promoCode);
          return {
               valid: promoResult.valid,
               promo: promoResult.promo || null,
               reason: promoResult.reason
          };
     }


     refererCorrectionAdjustment(tenantId: number, billingid: number, employeeid: number, entity_type:number, entity_id:number): Promise<boolean> {
          // Implementation here
          return Promise.resolve(true); // Placeholder for actual implementation
     }
}

     export const CustomerBillingCheckout = CustomerBillingCheckoutSingleton;
