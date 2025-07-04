import { SalesSessionRepo } from "../repositories/SalesSessionRepo";
import { BillErrors, EntityType } from "./billing_shared_types";
import KnexConnection from "../../../database/KnexConnections";
import BillingStrategy from "../../clincians/billingstrategy";
import ApplicationSettings from "../../application/appsettings/appset";
import { PrimeLimsTablebilling, PrimeLimsTabledboservices } from "../../../database/DatabaseTableSchema";
import { ReferralCodingRepo } from "../../referral/repositories/ReferralCodingRepo";
import { BillingModuleCodes, BillingTestItem, CustomerInitResponse } from "./billingTypes";
import { PackageBillingHelper } from "./packageBillingHelper";
import { PrimeBillingEnterprise } from "./PrimeBillingEnterprise";
import { Billing } from "../billing";
import { Console } from "winston/lib/winston/transports";

class CustomerBillingInitSingleton extends PrimeBillingEnterprise {
     static instance: CustomerBillingInitSingleton;
     static BillingModuleCodes = BillingModuleCodes;
     static BillErrors = BillErrors;

     private constructor(public tenantId: number) {
          super(tenantId);
     }

     static getInstance(tenantId: number) {
          if (!CustomerBillingInitSingleton.instance || CustomerBillingInitSingleton.instance.tenantId !== tenantId) {
               CustomerBillingInitSingleton.instance = new CustomerBillingInitSingleton(tenantId);
          }
          return CustomerBillingInitSingleton.instance;
     }

     async init(params: {
          entityId: number;
          entityType: EntityType,
          patientId: number;
          isPackageUsed?: boolean;
          billingid?: number;
          packageid?: number;
          includeServices?: boolean;
          branchid: number;
          billingSource: number;
          referalCode: number | undefined;
     }): Promise<CustomerInitResponse | string | []> {
          const validationError = CustomerBillingInitSingleton.validateBillingInput({
               patientId: params.patientId,
               branchid: params.branchid,
               billingSource: params.billingSource,
               cart: [],
               servicesList: [],
               errorCodes: {
                    NO_PATIENT_ID: BillingModuleCodes.MODULE_NO_PATIENT_ID,
                    NO_BRANCH_ID: BillingModuleCodes.BRANCH_ID_NOT_PROVIDED,
                    NO_BILLING_SOURCE: BillingModuleCodes.BILLINGSOURCE_NOT_PROVIDED,
                    CART_AND_SERVICES_EMPTY: "Cart and servicesList are both empty"
               }
          });

          if (validationError) return validationError;
          if (!params.patientId) return BillingModuleCodes.MODULE_NO_PATIENT_ID;
          if (params.billingSource === undefined || params.billingSource === null) return BillingModuleCodes.BILLINGSOURCE_NOT_PROVIDED;
          if (params.branchid === undefined || params.branchid === null) return BillingModuleCodes.BRANCH_ID_NOT_PROVIDED;

          const [sessionExists, hasDebt, appsettings, taxation, paymentModes] = await Promise.all([
               this.hasActiveSession(params.branchid),
               this.hasOutstandingDebt(params.patientId),
               new ApplicationSettings().getAllAppSettings(this.tenantId),
               new ApplicationSettings().getAppBillSettings(this.tenantId),
               this.getPaymentModes()
          ]);

          if (!sessionExists) return BillingModuleCodes.MODULE_NO_SESSION;

          let previousRecordsSummary = null;
          if (params.billingid) previousRecordsSummary = this.previousBillingSummary(params.billingid)

          if (hasDebt) return BillingModuleCodes.MODULE_DEBT;
          if (!appsettings) return [];
          if (params.billingid !== undefined && (typeof params.billingid !== 'number' || isNaN(params.billingid))) return BillingModuleCodes.MODULE_NO_VALID_BILLING_ID;
          if (params.billingid && params.billingid <= 0) return BillingModuleCodes.MODULE_NO_VALID_BILLING_ID;

          if (params.billingid && !(await Billing.checkValidityOfBillingid(this.tenantId, params.billingid))) {
               return BillingModuleCodes.MODULE_NO_VALID_BILLING;
          }
          if (params.isPackageUsed && !params.packageid) return BillingModuleCodes.NO_PACKAGE_ID_SPECIFIED;


          let defaultCustomerInitData = this.getDefaultCustomerInitData(params, previousRecordsSummary);

          if (params.isPackageUsed && params.packageid) {
               return await PackageBillingHelper.handlePackageInit({
                    tenantId: this.tenantId,
                    packageid: params.packageid,
                    patientId: params.patientId,
                    billingid: params.billingid,
                    defaultCustomerInitData,
                    getConstantCustomerInitData: this.getConstantCustomerInitData.bind(this)
               });
          }

          await this.handleReferralCode(defaultCustomerInitData);
          await this.handleApplicableTests(defaultCustomerInitData, appsettings, taxation, params.isPackageUsed);
          await this.handleServices(defaultCustomerInitData, appsettings, taxation, params.includeServices);
          await this.finalizePromoLogic(defaultCustomerInitData);
          this.setSummaryAndPayment(defaultCustomerInitData, previousRecordsSummary, paymentModes, params);
          return defaultCustomerInitData;
     }

     private async hasActiveSession(branchid: number) {
          const sessionRepo = new SalesSessionRepo(this.tenantId);
          const today = (new Date() as unknown) as string;
          return await sessionRepo.hasActiveSessionForDate(today, branchid);
     }

     private getDefaultCustomerInitData(params: any, previousRecordsSummary: any): CustomerInitResponse {
          return {
               testList: [],
               billingSource: params.billingSource,
               previousRecords: [],
               previousRecordsSummary: previousRecordsSummary,
               refundList: [],
               previousPaymentHistory: [],
               subtotal: 0,
               packageTestList: [],
               totalServiceAmount: 0,
               cart: [],
               totaldiscount: 0,
               totalAmountIncurredDueTax: 0,
               paid: 0,
               includeServices: !!params.includeServices,
               branchid: params.branchid,
               balance: 0,
               promoCode: undefined,
               servicesProvided: [],
               taxIncluded: false,
               billingid: params.billingid,
               packageid: params.packageid,
               isPackageUsed: params.isPackageUsed,
               hasNightAdjustment: false,
               nightAdjustmentValue: 0,
               nightAdjustmentMode: 'none',
               patientId: params.patientId,
               taxValue: 0,
               entityId: params.entityId,
               entityType: params.entityType,
               referalCode: params.referalCode,
               totalcost: 0,
               totalServiceAmountPayable: 0,
               amountPayable: 0,
          };
     }

     private async handleReferralCode(defaultCustomerInitData: any) {
          if (defaultCustomerInitData.referalCode) {
               const referalRepo = await new ReferralCodingRepo(this.tenantId).findByCode(parseInt(defaultCustomerInitData.referalCode.toString(), 10));
               if (referalRepo) {
                    defaultCustomerInitData.entityType = referalRepo.entity_type;
                    defaultCustomerInitData.entityId = referalRepo.entity_id;
               }
          }
     }

     private async handleApplicableTests(defaultCustomerInitData: any, appsettings: any, taxation: any, isPackageUsed: boolean) {
          let ApplicableTest: BillingTestItem[] = [];
          if ((!defaultCustomerInitData.entityType || defaultCustomerInitData.entityType == "general") && (!defaultCustomerInitData.entityId && !defaultCustomerInitData.referalCode)) {
               ApplicableTest = await new BillingStrategy().getProvidentialBillingHandler(this.tenantId, 'general', null, true);
          } else {
               ApplicableTest = await new BillingStrategy().getProvidentialBillingHandler(this.tenantId, defaultCustomerInitData.entityType, defaultCustomerInitData.entityId, true);
          }
          if (defaultCustomerInitData.promoCode && defaultCustomerInitData.promoCode.value && defaultCustomerInitData.promoCode.type) {
               // Only apply promo, not regular discounts
               ApplicableTest = PrimeBillingEnterprise.applyPromoToItems(ApplicableTest, defaultCustomerInitData.promoCode);
          } else {
               ApplicableTest = PrimeBillingEnterprise.applyDiscountsToTests(ApplicableTest);
          }
          if (appsettings.billingsettings && appsettings.billingsettings.hasNightAdjustment && !isPackageUsed) {
               ApplicableTest = PrimeBillingEnterprise.applyNightAdjustmentsToTests(ApplicableTest, appsettings.billingsettings, 'test');
               defaultCustomerInitData.hasNightAdjustment = true;
               defaultCustomerInitData.nightAdjustmentValue = appsettings.billingsettings.nightAdjustmentValue ? Number(appsettings.billingsettings.nightAdjustmentValue) : undefined;
               defaultCustomerInitData.nightAdjustmentMode = appsettings.billingsettings.nightAdjustmentMode;
               defaultCustomerInitData.startTime = appsettings.billingsettings.startTime;
               defaultCustomerInitData.endTime = appsettings.billingsettings.endTime;
          }
          if (appsettings.includeTax && appsettings.includeTax === 1 && taxation && taxation.taxValue > 0) {
               ApplicableTest = PrimeBillingEnterprise.applyTaxToTests(ApplicableTest, taxation.taxValue);
               defaultCustomerInitData.taxIncluded = true;
               taxation.taxValue = taxation.taxValue || 0;
          }

          defaultCustomerInitData.testList = ApplicableTest;
     }

     public async handleServices(defaultCustomerInitData: any, appsettings: any, taxation: any, includeServices: boolean) {
          if (!includeServices) return;
          const servicesList = await PrimeBillingEnterprise.recalculateInitServicesList(this.tenantId, appsettings, taxation);
          (defaultCustomerInitData as any).servicesList = servicesList;
     }

     private async finalizePromoLogic(defaultCustomerInitData: any) {
          if (!defaultCustomerInitData || !defaultCustomerInitData.testList || !Array.isArray(defaultCustomerInitData.testList)) return;
          let items = defaultCustomerInitData.testList;
          const billingsettings = defaultCustomerInitData.billingsettings || {};
          const promo = defaultCustomerInitData.promoCode;
          const taxValue = defaultCustomerInitData.taxValue || 0;

          if (billingsettings && billingsettings.hasNightAdjustment) {
               items = PrimeBillingEnterprise.applyNightAdjustmentsToTests(items, billingsettings, 'test');
          }
          items = PrimeBillingEnterprise.applyDiscountsToTests(items);
          if (promo && promo.value && promo.type) {
               items = PrimeBillingEnterprise.applyPromoToItems(items, promo);
          }
          if (taxValue > 0) {
               items = PrimeBillingEnterprise.applyTaxToTests(items, taxValue);
          }
          defaultCustomerInitData.testList = items;
     }

     private setSummaryAndPayment(defaultCustomerInitData: any, previousRecordsSummary: any, paymentModes: any, params: any) {
          defaultCustomerInitData.subtotal = 0;
          defaultCustomerInitData.totaldiscount = 0;
          defaultCustomerInitData.totalAmountIncurredDueTax = 0;
          defaultCustomerInitData.totalcost = 0;
          defaultCustomerInitData.cost = 0;
          defaultCustomerInitData.amountPayable = 0;
          defaultCustomerInitData.totalAmountIncurredDueTax = 0;
          defaultCustomerInitData.previousRecordsSummary = previousRecordsSummary;
          defaultCustomerInitData.paid = previousRecordsSummary?.paid || 0;
          defaultCustomerInitData.balance = previousRecordsSummary?.balance || 0;
          if (!params.entityType || !params.entityId) {
               defaultCustomerInitData.entityType = "general" as EntityType;
               defaultCustomerInitData.entityId = null;
               (defaultCustomerInitData as any).registrationType = "self";
          }
          (defaultCustomerInitData as any).paymentModes = paymentModes;
     }



     private async getPaymentModes() {
          const conn = await KnexConnection(this.tenantId);
          return await conn('paymentModes').select();
     }

     private async getConstantCustomerInitData(patientId: number, billingid: number | undefined): Promise<{
          paymentModes: any[],
          previousRecords: PrimeLimsTabledboservices[],
          previousRecordsSummary: PrimeLimsTablebilling | null,
          previousPaymentHistory: any[]
     }> {
          const conn = await KnexConnection(this.tenantId);
          const paymentModes = await conn('paymentModes').select();
          let previousRecords: PrimeLimsTabledboservices[] = [];
          if (billingid) {
               previousRecords = await conn('dboservices').where('billingid', billingid).select();
          }
          let previousPaymentHistory: any[] = [];
          if (billingid) {
               previousPaymentHistory = await conn('billinghx').where('billingid', billingid).select();
          }
          let previousRecordsSummary: PrimeLimsTablebilling | null = null;
          const summary = await conn('billing').where('patientid', patientId).orderBy('billingid', 'desc').first();
          if (summary) previousRecordsSummary = summary;
          return { paymentModes, previousRecords, previousRecordsSummary, previousPaymentHistory };
     }
}

export const CustomerBillingInit = CustomerBillingInitSingleton;
