import KnexConnection from "../../../database/KnexConnections";
import { ApplicationSettingsData, AppSetting } from "../../application/appsettings/Type";
import { Billing } from "../../../../obso/billing";
import { serviceCategory } from "../billingclientTypes";
import { PrimeBillingPromoCodeRepo } from "../repositories/PrimeBillingPromoCodeRepo";
import { EntityType } from "./billing_shared_types";
import { PackageBillingHelper } from "./packageBillingHelper";
import { PrimeBillingEnterprise } from "./PrimeBillingEnterprise";
import { applyDboservicesAfterUpdate } from "../../../database/appLevelTriggers";
import User from "../../../LobnosAuth/user";
import DiscountLimitService from "../billing-services/discount-limit";



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
          employeeid,
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

          let totalOutstanding = 0;
          let AllowCrmToGiveDisocunt = false;
          const appsettings: ApplicationSettingsData | null = await this.getAppSettings();

          if (!appsettings) {
               return { success: false, message: 'application settings not created,kindly contact administrator to create application settings for billing module' };
          }

          if (appsettings && appsettings['AllowCrmToGiveDisocunt']) {
               AllowCrmToGiveDisocunt = parseInt(appsettings?.AllowCrmToGiveDisocunt.toString()) == 1
          }

          if (!ispricingcheckout && parseInt(billingSource) != 4) {
               totalOutstanding = await this.getCustomerOutstandingDebt(patientId);
               const isBillBePaidBeforeAllTransactions = parseInt(appsettings['PaidBillsBeforeTransaction'].toString())
               if (totalOutstanding > 0 && isBillBePaidBeforeAllTransactions) return { success: false, message: 'Outstanding debt found' };
          }


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
               totalsurcharge,
               totalAmountIncurredDueTax,
               totalServiceAmount
          } = PrimeBillingEnterprise.calculateBillingTotals({
               usedPackage,
               recalculatedPackageList,
               recalculatedCart,
               recalculatedServicesList
          });


          const toFixed2 = (num: number) => {
               if (typeof num !== 'number' || isNaN(num)) return 0;
               const fixed = Number(num.toFixed(2));
               return isNaN(fixed) ? 0 : fixed;
          };

          const paid = toFixed2(paymentDetails && paymentDetails.amount ? paymentDetails.amount : 0);
          const totalTestAmountPayable = toFixed2(recalculatedCart.reduce((sum, item) => sum + (item.totalpayable || 0), 0));
          const totalServiceAmountPayable = toFixed2(recalculatedServicesList.reduce((sum, item) => sum + (item.totalpayable || 0), 0));
          const overallPayable = totalServiceAmountPayable + totalTestAmountPayable + (totalsurcharge || 0);
          const totalPacKageAmountPayable = toFixed2(recalculatedPackageList.reduce((sum, item) => sum + (item.totalpayable || 0), 0));

          const amountPayable = isPackageUsed ? toFixed2(totalPacKageAmountPayable) : toFixed2(overallPayable);
          const outstanding = toFixed2(amountPayable - paid);
          const balance = paid > amountPayable ? toFixed2(paid - amountPayable) : 0;

          if (balance < 0) {
               return { success: false, message: 'Paid amount exceeds total payable amount', data: { balance } };
          }

          const isFreeMode = paymentDetails?.mode === 'free';

          const computeAdjustmentTotals = (items: any[]) => {
               let discountTotal = 0;
               let surchargeTotal = 0;
               if (!Array.isArray(items)) return { discountTotal, surchargeTotal };
               for (const item of items) {
                    const adjType = typeof item?.userAdjustmentType === 'string' ? item.userAdjustmentType.toLowerCase() : item?.userAdjustmentType;
                    const adjValueRaw = item?.userAdjustedValue;
                    const adjValue = Math.abs(Number(adjValueRaw || 0));
                    if (adjType === 'discount' && adjValue > 0) {
                         discountTotal += adjValue;
                         continue;
                    }
                    if (adjType === 'surcharge' && adjValue > 0) {
                         surchargeTotal += adjValue;
                         continue;
                    }
                    const promoDiscount = Number(item?.promoDiscount || 0);
                    if (promoDiscount > 0) continue;
                    const itemDiscount = Math.abs(Number(item?.discount || 0));
                    if (itemDiscount > 0) {
                         discountTotal += itemDiscount;
                    }
               }
               return { discountTotal, surchargeTotal };
          };

          const adjustmentItems = [
               ...(Array.isArray(recalculatedCart) ? recalculatedCart : []),
               ...(Array.isArray(recalculatedServicesList) ? recalculatedServicesList : []),
               ...(Array.isArray(recalculatedPackageList) ? recalculatedPackageList : [])
          ];


          const role = await new User().getUserRole(employeeid, tenantId);
          const computedAdjustments = computeAdjustmentTotals(adjustmentItems);
          if (employeeid && !isFreeMode && role && typeof role == "string" && role != "admin") {
               try {
                    await DiscountLimitService.enforceOnly({
                         tenantId,
                         employeeid,
                         subtotal: toFixed2(subtotal),
                         payable: amountPayable,
                         discountTotal: computedAdjustments.discountTotal,
                         surchargeTotal: computedAdjustments.surchargeTotal
                    });
               } catch (err: any) {
                    return { success: false, message: err && err.message ? err.message : 'Discount/surcharge limit validation failed' };
               }
          }

          const discountLimitInfo = employeeid ? await DiscountLimitService.getRoleLimitInfo({ tenantId, employeeid }) : null;
          const exposedRule = discountLimitInfo && discountLimitInfo.rule
               ? {
                    role: discountLimitInfo.role,
                    max_discount_per_transaction: discountLimitInfo.rule.max_discount_per_transaction ?? null,
                    min_transaction_total_for_discount: discountLimitInfo.rule.min_transaction_total_for_discount ?? null,
                    max_discount_per_day: discountLimitInfo.rule.max_discount_per_day ?? null,
                    max_surcharge_per_transaction: discountLimitInfo.rule.max_surcharge_per_transaction ?? null,
                    min_transaction_total_for_surcharge: discountLimitInfo.rule.min_transaction_total_for_surcharge ?? null,
                    max_surcharge_per_day: discountLimitInfo.rule.max_surcharge_per_day ?? null,
                    usage_date: discountLimitInfo.usageDate,
                    daily_used_discount: discountLimitInfo.dailyUsedDiscount,
                    daily_remaining_discount: discountLimitInfo.dailyRemainingDiscount,
                    daily_used_surcharge: discountLimitInfo.dailyUsedSurcharge,
                    daily_remaining_surcharge: discountLimitInfo.dailyRemainingSurcharge,
                    rule_found: discountLimitInfo.ruleFound,
                    allowed_role: discountLimitInfo.allowedRole
               }
               : (discountLimitInfo
                    ? {
                         role: discountLimitInfo.role,
                         usage_date: discountLimitInfo.usageDate,
                         daily_used_discount: discountLimitInfo.dailyUsedDiscount,
                         daily_remaining_discount: discountLimitInfo.dailyRemainingDiscount,
                         daily_used_surcharge: discountLimitInfo.dailyUsedSurcharge,
                         daily_remaining_surcharge: discountLimitInfo.dailyRemainingSurcharge,
                         rule_found: false,
                         allowed_role: discountLimitInfo.allowedRole
                    }
                    : null);

          if (isFreeMode) {
               const zeroOutItem = (item: any) => ({
                    ...item,
                    totalpayable: 0,
                    totalcost: 0,
                    discountedValue: 0,
                    amountIncurredDueTax: 0,
                    price: 0,
                    actualPrice: 0,
                    originalPrice: 0,
                    servicePrice: 0
               });

               recalculatedCart = recalculatedCart.map(zeroOutItem);
               recalculatedServicesList = recalculatedServicesList.map(zeroOutItem);
               if (usedPackage) {
                    recalculatedPackageList = recalculatedPackageList.map(zeroOutItem);
               }

               return {
                    success: true,
                    message: 'Checkout recalculation successful for free mode. No payment required.',
                    data: {
                         subtotal: 0,
                         totalcost: 0,
                         totaldiscount: 0,
                         totalAmountIncurredDueTax: 0,
                         totalServiceAmount: 0,
                         amountPayable: 0,
                         outstanding: 0,
                         totalTestAmountPayable: 0,
                         totalServiceAmountPayable: 0,
                         totalsurcharge: 0,
                         paid: 0,
                         balance: 0,
                         cart: recalculatedCart.map(item => ({
                              ...item,
                              totalpayable: 0,
                              totalcost: 0,
                              discountedValue: 0,
                              amountIncurredDueTax: 0,
                              price: 0,
                              actualPrice: 0,
                              originalPrice: 0,
                              entitytype: item.entitytype || entitytype,
                              entityId: item.entityId || entityid
                         })),
                         servicesList: recalculatedServicesList.map(item => ({
                              ...item,
                              totalpayable: 0,
                              totalcost: 0,
                              discountedValue: 0,
                              amountIncurredDueTax: 0,
                              servicePrice: 0,
                              entitytype: item.entitytype || entitytype,
                              entityId: item.entityId || entityid
                         })),
                         promoCode: promoCode || undefined,
                         promoDiscount: 0,
                         isPromo: !!isPromo,
                         isPackageUsed: !!isPackageUsed,
                         packageid: packageid || undefined,
                         packageTestList: usedPackage ? recalculatedPackageList : undefined,
                         promoDetails: promoValid ? promoDetails : undefined,
                         paymentStatus: 'completed',
                         paymentReceived: true,
                         taxIncluded: false,
                         taxList: undefined,
                         discountLimitInfo: exposedRule,
                         entitytype,
                         entityId: entityid,
                         ispricingcheckout,
                         entityid,
                         previousBilling,
                         previousServices
                    }
               };
          }

          return {
               success: true,
               message: 'Checkout recalculation successful. No payment has been received yet.',
               data: {
                    subtotal: toFixed2(subtotal),
                    totalcost: totalpayable,
                    totaldiscount: toFixed2(totaldiscount),
                    totalAmountIncurredDueTax: toFixed2(totalAmountIncurredDueTax),
                    totalServiceAmount: toFixed2(totalServiceAmount),
                    amountPayable: totalpayable,
                    actualAmount: totalpayable - (totalsurcharge || 0),
                    outstanding,
                    totalTestAmountPayable,
                    totalServiceAmountPayable,
                    totalsurcharge,
                    paid,
                    balance,
                    cart: recalculatedCart.map(item => ({
                         ...item,
                         totalpayable: toFixed2(item.totalpayable),
                         totalcost: toFixed2(item.totalcost),
                         discountedValue: toFixed2(item.discountedValue),
                         amountIncurredDueTax: toFixed2(item.amountIncurredDueTax),
                         price: toFixed2(item.price),
                         actualPrice: toFixed2(item.actualPrice),
                         originalPrice: toFixed2(item.originalPrice),
                         entitytype: item.entitytype || entitytype,
                         entityId: item.entityId || entityid
                    })),
                    servicesList: recalculatedServicesList.map(item => ({
                         ...item,
                         totalpayable: toFixed2(item.totalpayable),
                         totalcost: toFixed2(item.totalcost),
                         discountedValue: toFixed2(item.discountedValue),
                         amountIncurredDueTax: toFixed2(item.amountIncurredDueTax),
                         servicePrice: toFixed2(item.servicePrice),
                         entitytype: item.entitytype || entitytype,
                         entityId: item.entityId || entityid
                    })),
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
                    discountLimitInfo: exposedRule,
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

          const isPromoApplied = promoValid && promoCode;

          let recalculatedCart = allTests
               .filter((test: any) => selectedTestIds.includes(test.testid))
               .map((test: any, index: number) => {
                    const cartItem = cart.find(item => item.testid === test.testid);
                    return {
                         ...test,
                         price: test.price,
                         userAdjustmentType: cartItem ? cartItem.userAdjustmentType : null,
                         userAdjustedValue: cartItem ? cartItem.userAdjustedValue : null,
                         discount: cartItem ? isPromoApplied ? 0 : cartItem.discount : 0
                    }
               })

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
          // check here double discount
          if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
               recalculatedCart = PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, taxation.taxValue);
          } else {
               recalculatedCart = PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, 0);
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
     private static determineBillingSourceUsingEntityType(entity_type: EntityType): number | null {
          switch (entity_type) {
               case 'general':
                    return 1;
               case 'clinician':
                    return 6;
               case 'organization':
                    return 2;
               case 'phis':
                    return 3;
               case 'insurance':
                    return 4;
               default:
                    return null
          }
     }

     private static buildServiceUpdatePayload(billingSource: number, entity_id?: number): any {
          return {
               serviceCategory: serviceCategory[billingSource],
               clinicianId: billingSource === 6 ? entity_id : null,
               organizationId: billingSource === 2 ? entity_id : null,
               categoryTrackId: billingSource,
               isNHIS: billingSource === 4 ? 1 : 0,
               isPHIS: billingSource === 3 ? 1 : 0,
               insuranceid: billingSource === 4 || billingSource === 3 ? entity_id : null,
               isCorrected: 1,
          };
     }

     private static async performRefererErrorCorrection(
          tenantId: number,
          billingid: number,
          employeeId: number,
          billingSource: number,
          entity_id?: number,
          logContext?: any
     ): Promise<{ success: boolean; message: string; data?: any }> {
          const conn = await KnexConnection(tenantId);
          const transaction = await conn.transaction();

          try {
               const transactionServices = await transaction('dboservices').where('billingid', billingid);
               if (transactionServices.length === 0) {
                    await transaction.rollback();
                    return { success: false, message: 'No services found for the provided billingid' };
               }

               const updatePayload = this.buildServiceUpdatePayload(billingSource, entity_id);
               for (const service of transactionServices) {
                    await transaction('dboservices')
                         .where('serviceid', service.serviceid)
                         .andWhere('billingid', billingid)
                         .update(updatePayload);

                    const updatedService = await transaction('dboservices').where({ serviceid: service.serviceid }).first();
                    if (updatedService) {
                         await applyDboservicesAfterUpdate(transaction, updatedService, employeeId ? employeeId.toString() : undefined);
                    }
               }

               await transaction('billing')
                    .where('billingid', billingid)
                    .update({
                         adjustmentType: 'referer-error',
                         adjustmentReason: 'Referer error correction',
                         adjustmentdate: new Date(),
                         isAdjustment: 1,
                         islocked: 1,
                         adjustedBy: employeeId,
                    });

               await transaction.commit();
               return { success: true, message: 'Referer error correction successful', data: { billingid, billingSource } };
          } catch (error) {
               console.error('Error during referer error correction:', error, { billingid, ...logContext });
               await transaction.rollback();
               return { success: false, message: 'Transaction failed' };
          }
     }

     public static async correctRefererErrorPostToGeneralRegistration(tenantId: number, billingid: number, branchid: number, employeeId: number): Promise<{ success: boolean; message: string; data?: any }> {
          if (billingid === undefined || billingid === null)
               return { success: false, message: 'No billingid provided' };

          const isBillingIdValid = await Billing.checkValidityOfBillingid(tenantId, billingid);
          if (!isBillingIdValid)
               return { success: false, message: 'Invalid billingid provided' };

          if (branchid === undefined || branchid === null)
               return { success: false, message: 'No branchid provided' };

          return this.performRefererErrorCorrection(tenantId, billingid, employeeId, 1, undefined, { billingid });
     }

     public static async correctRefererErrorPostRegistration(tenantId: number, employeeId: number, entity_type: EntityType, entity_id: number, billingid: number, branchid: number): Promise<{ success: boolean; message: string; data?: any }> {
          if (!entity_type || !entity_id)
               return { success: false, message: 'No entity_type or entity_id provided' };

          if (billingid === undefined || billingid === null)
               return { success: false, message: 'No billingid provided' };

          const isBillingIdValid = await Billing.checkValidityOfBillingid(tenantId, billingid);
          if (!isBillingIdValid)
               return { success: false, message: 'Invalid billingid provided' };

          if (branchid === undefined || branchid === null)
               return { success: false, message: 'No branchid provided' };

          const billingSource = this.determineBillingSourceUsingEntityType(entity_type);
          if (billingSource === undefined || billingSource === null)
               return { success: false, message: 'No billingSource provided' };

          return this.performRefererErrorCorrection(tenantId, billingid, employeeId, billingSource, entity_id, { entity_id, entity_type, billingid });
     }
}

export const CustomerBillingCheckout = CustomerBillingCheckoutSingleton;
