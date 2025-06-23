import { SalesSessionRepo } from "./repositories/SalesSessionRepo";
import { BillErrors, EntityType } from "./billing_shared_types";
import KnexConnection from "../../database/KnexConnections";
import { Packages } from "./packages/Billlingpackages";
import BillingStrategy from "../clincians/billingstrategy";
import ApplicationSettings from "../application/appsettings/appset";
import { ApplicationSettingsData, AppSetting } from "../application/appsettings/Type";
import { PrimeLimsTablebilling, PrimeLimsTabledboservices } from "../../database/DatabaseTableSchema";
import { ReferralCodingRepo } from "../referral/repositories/ReferralCodingRepo";
import Services from "../services/services";

const BillingModuleCodes = {
     MODULE_DEBT: 'outstanding debt found',
     MODULE_NO_SESSION: 'no active sales session found',
     MODULE_NO_VALID_BILLING_ID: 'no valid billing ID provided',
     MODULE_NO_PATIENT_ID: 'no patient ID provided',
     BILLINGSOURCE_NOT_PROVIDED: 'billing source not provided',
     NO_PACKAGES_FOUND_FOR_ENTITY: 'no packages found for entity',
     NO_PACKAGE_ID_SPECIFIED: 'no package id specified',
     INVALID_PACKAGE_PROVIDED: 'invalid package provided',
     BRANCH_ID_NOT_PROVIDED: 'branch id not provided',
} as const;

export type BillingTestItem = {
     discountedValue: number;
     price: number;
     name: string;
     id: number;
     testid: number;
     concessionMode: "absolute" | "percentage" | string;
     concessionValue: string;
     actualPrice: number;
     isoutsourced: number;
     discount?: number;
     amountIncurredDueTax?: number;
     originalPrice: number;
     pricingType: string;
};

export interface CustomerInitResponse {
     testList: BillingTestItem[];
     previousRecords: PrimeLimsTabledboservices[] | [],
     previousRecordsSummary: PrimeLimsTablebilling | null,
     refundList: any[],
     previousPaymentHistory?: any[];
     subtotal: number;
     totaldiscount: number;
     totalAmountIncurredDueTax: number;
     paid: number;
     balance: number;
     includeServices: boolean;
     promoCode?: string;
     billingid?: number;
     billingSource?: number;
     servicesProvided: any[];
     branchid: number;
     cart: any[],
     packageid?: number;
     hasNightAdjustment?: boolean;
     nightAdjustmentValue?: number;
     nightAdjustmentMode?: string;
     startTime?: string;
     endTime?: string;
     referalCode?: number;
     entityId?: number;
     entityType?: EntityType;
     patientId: number;
     isPackageUsed?: boolean;
}

export class CustomerBillingInit {
     static BillingModuleCodes = BillingModuleCodes;
     static BillErrors = BillErrors;

     constructor(public tenantId: number) { }

     async initCustomerBilling({
          entityId,
          entityType,
          packageid,
          patientId,
          includeServices = false,
          isPackageUsed = false,
          billingid,
          branchid,
          billingSource,
          referalCode
     }: {
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
          if (!patientId) return BillingModuleCodes.MODULE_NO_PATIENT_ID;

          if (billingSource === undefined || billingSource === null) return BillingModuleCodes.BILLINGSOURCE_NOT_PROVIDED;

          if (branchid === undefined || branchid === null) return BillingModuleCodes.BRANCH_ID_NOT_PROVIDED;

          let defaultCustomerInitData: CustomerInitResponse = {
               testList: [],
               billingSource: billingSource,
               previousRecords: [],
               previousRecordsSummary: null,
               refundList: [],
               previousPaymentHistory: [],
               subtotal: 0,
               cart: [],
               totaldiscount: 0,
               totalAmountIncurredDueTax: 0,
               paid: 0,
               includeServices: !!includeServices,
               branchid,
               balance: 0,
               promoCode: undefined,
               servicesProvided: [],
               billingid: billingid,
               packageid: packageid,
               isPackageUsed: isPackageUsed,
               hasNightAdjustment: false,
               nightAdjustmentValue: undefined,
               nightAdjustmentMode: undefined,
               patientId: patientId,
               entityId: entityId,
               entityType: entityType,
               referalCode: referalCode,
          };

          const appsettings: ApplicationSettingsData | null = await new ApplicationSettings().getAllAppSettings(this.tenantId);
          if (!appsettings) return [];

          const { includeTax, PaidBillsBeforeTransaction, billingsettings } = appsettings;

          if (PaidBillsBeforeTransaction === 1) {
               const outstanding = await this.calculateCustomerOutstandingDebt(patientId);
               if (outstanding && outstanding != 0) return BillingModuleCodes.MODULE_DEBT;
          }

          if (billingid !== undefined && (typeof billingid !== 'number' || isNaN(billingid))) return BillingModuleCodes.MODULE_NO_VALID_BILLING_ID;

          if (billingid !== undefined) {
               const conn = await KnexConnection(this.tenantId);
               const existing = await conn('billing').where('billingid', billingid).first();
               if (!existing) return BillingModuleCodes.MODULE_NO_VALID_BILLING_ID;
          }

          const hasDebt = await this.calculateCustomerOutstandingDebt(patientId);
          if (hasDebt) return BillingModuleCodes.MODULE_DEBT;

          const sessionRepo = new SalesSessionRepo(this.tenantId);
          const today = (new Date() as unknown) as string;
          const sessionExists = await sessionRepo.hasActiveSessionForDate(today, branchid);
          if (!sessionExists) return BillErrors.NoBillingSession;

          if (billingid !== undefined) {
               const conn = await KnexConnection(this.tenantId);
               const billing = await conn('billing').where('billingid', billingid).first();
               return billing;
          }

          if (isPackageUsed && !packageid) return BillingModuleCodes.NO_PACKAGE_ID_SPECIFIED;

          if (isPackageUsed && packageid) {
               const isPackageValid = await Packages.verifyPackageId(this.tenantId, packageid);
               if (!isPackageValid) return BillingModuleCodes.INVALID_PACKAGE_PROVIDED;

               const packageData = await Packages.getPackagesForEntity({
                    entityId,
                    entitytype: entityType,
                    tenantId: this.tenantId,
                    categorytrackid: billingSource
               });

               if (Array.isArray(packageData) && packageData.length === 0) return BillingModuleCodes.NO_PACKAGES_FOUND_FOR_ENTITY;
               else {
                    const ApplicableTest = await Packages.getPackageTests(this.tenantId, packageid);
                    if (Array.isArray(ApplicableTest) && ApplicableTest.length > 0) {
                         const reformattedTest = ApplicableTest.map(test => ({
                              ...test,
                              discountedValue: test.price,
                              testid: test.test_id,
                              discount: test.discount || 0
                         }));
                         return {
                              ...defaultCustomerInitData,
                              packageid: packageid,
                              isPackageUsed: true,
                              testList: reformattedTest,
                              previousRecords: [],
                         };
                    }
                    return [];
               }
          }

          if (defaultCustomerInitData.referalCode) {
               const referalCode = defaultCustomerInitData.referalCode;
               const referalRepo = await new ReferralCodingRepo(this.tenantId).findByCode(parseInt(referalCode.toString(), 10));
               if (referalCode) {
                    defaultCustomerInitData.entityType = referalRepo.entity_type;
                    defaultCustomerInitData.entityId = referalRepo.entity_id;
               }
          }

          let ApplicableTest: BillingTestItem[] = [];

          if ((!defaultCustomerInitData.entityType || defaultCustomerInitData.entityType == "general") && (!defaultCustomerInitData.entityId && !defaultCustomerInitData.referalCode)) {
               ApplicableTest = await new BillingStrategy().getProvidentialBillingHandler(this.tenantId, 'general', null, true);
               defaultCustomerInitData.testList = ApplicableTest;
          } else {
               ApplicableTest = await new BillingStrategy().getProvidentialBillingHandler(this.tenantId, defaultCustomerInitData.entityType, defaultCustomerInitData.entityId, true);
               defaultCustomerInitData.testList = ApplicableTest;
          }

          let previousRecords: PrimeLimsTabledboservices[] = [];
          if (billingid) {
               const conn = await KnexConnection(this.tenantId);
               previousRecords = await conn('dboservices').where('billingid', billingid).select();
          }
          defaultCustomerInitData.previousRecords = previousRecords;

          let previousPaymentHistory: any[] = [];
          if (billingid) {
               const conn = await KnexConnection(this.tenantId);
               previousPaymentHistory = await conn('billinghx').where('billingid', billingid).select();
          }
          defaultCustomerInitData.previousPaymentHistory = previousPaymentHistory;

          if (ApplicableTest && ApplicableTest.length > 0) {
               ApplicableTest = CustomerBillingInit.applyDiscountsToTests(ApplicableTest);
               defaultCustomerInitData.testList = ApplicableTest;
          }

          if (billingsettings && billingsettings.hasNightAdjustment) {
               ApplicableTest = CustomerBillingInit.applyNightAdjustmentsToTests(ApplicableTest, billingsettings);
               defaultCustomerInitData.testList = ApplicableTest;
               defaultCustomerInitData.hasNightAdjustment = true;
               defaultCustomerInitData.nightAdjustmentValue = billingsettings.nightAdjustmentValue ? Number(billingsettings.nightAdjustmentValue) : undefined;
               defaultCustomerInitData.nightAdjustmentMode = billingsettings.nightAdjustmentMode;
               defaultCustomerInitData.startTime = billingsettings.startTime;
               defaultCustomerInitData.endTime = billingsettings.endTime;
          }

          const taxation: Partial<AppSetting> = await new ApplicationSettings().getAppBillSettings(this.tenantId);
          if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
               ApplicableTest = CustomerBillingInit.applyTaxToTests(ApplicableTest, taxation.taxValue);
               defaultCustomerInitData.testList = ApplicableTest;
          }



          if (includeServices) {
               let servicesList = await new Services(0).getAllservices(this.tenantId, undefined, undefined);

               if (servicesList && Array.isArray(servicesList) && servicesList.length > 0) {
                    // Always apply discount first
                    servicesList = CustomerBillingInit.applyDiscountsToTests(servicesList);
                    // Then night adjustment
                    if (billingsettings && billingsettings.hasNightAdjustment) {
                         servicesList = CustomerBillingInit.applyNightAdjustmentsToTests(servicesList, billingsettings);
                    }
                    // Then tax
                    if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                         servicesList = CustomerBillingInit.applyTaxToTests(servicesList, taxation.taxValue);
                    }
               }
               (defaultCustomerInitData as any).servicesList = servicesList;
          }

          defaultCustomerInitData.subtotal = 0;
          defaultCustomerInitData.totaldiscount = 0;
          defaultCustomerInitData.totalAmountIncurredDueTax = 0;

          let previousRecordsSummary: PrimeLimsTablebilling | null = null;
          const conn = await KnexConnection(this.tenantId);
          const summary = await conn('billing').where('patientid', patientId).orderBy('billingid', 'desc').first();
          if (summary) previousRecordsSummary = summary;
          defaultCustomerInitData.previousRecordsSummary = previousRecordsSummary;
          defaultCustomerInitData.paid = previousRecordsSummary?.paid || 0;
          defaultCustomerInitData.balance = previousRecordsSummary?.balance || 0;

          if (!entityType || !entityId) {
               defaultCustomerInitData.entityType = "general" as EntityType;
               defaultCustomerInitData.entityId = null;
               (defaultCustomerInitData as any).registrationType = "self";
          }

          let paymentModes: any[] = [];
          {
               const conn = await KnexConnection(this.tenantId);
               paymentModes = await conn('paymentModes').select();
          }
          (defaultCustomerInitData as any).paymentModes = paymentModes;

          return defaultCustomerInitData;
     }

     async checkoutCustomerBilling({
          patientId,
          billingid,
          cart,
          servicesList,
          paymentDetails,
          branchid,
          billingSource,
          referalCode
     }: {
          patientId: number;
          billingid?: number;
          cart: any[];
          servicesList?: any[];
          paymentDetails: any;
          branchid: number;
          billingSource: number;
          referalCode?: number;
     }): Promise<{ success: boolean; message: string; data?: any }> {
          if (!patientId) return { success: false, message: 'No patientId provided' };
          if (!cart || !Array.isArray(cart) || cart.length === 0) return { success: false, message: 'Cart is empty' };
          if (!branchid) return { success: false, message: 'No branchid provided' };
          if (!billingSource) return { success: false, message: 'No billingSource provided' };

          // Validate session
          const sessionRepo = new SalesSessionRepo(this.tenantId);
          const today = (new Date() as unknown) as string;
          const sessionExists = await sessionRepo.hasActiveSessionForDate(today, branchid);
          if (!sessionExists) return { success: false, message: 'No active session' };

          // Validate outstanding debt
          const hasDebt = await this.calculateCustomerOutstandingDebt(patientId);
          if (hasDebt) return { success: false, message: 'Outstanding debt found' };

          // Calculate totals
          let subtotal = 0, totaldiscount = 0, totalAmountIncurredDueTax = 0;
          cart.forEach(item => {
               subtotal += item.discountedValue || item.price || item.servicePrice || 0;
               totaldiscount += item.discount || 0;
               totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
          });

          // Save billing record (pseudo-code, replace with your DB logic)
          // const conn = await KnexConnection(this.tenantId);
          // await conn('billing').insert({ ... });

          // Save payment record (pseudo-code)
          // await conn('payments').insert({ ... });

          // Return summary
          return {
               success: true,
               message: 'Checkout successful',
               data: {
                    subtotal,
                    totaldiscount,
                    totalAmountIncurredDueTax,
                    paid: paymentDetails.amount,
                    balance: subtotal + totalAmountIncurredDueTax - paymentDetails.amount,
                    cart,
                    servicesList
               }
          };
     }

     static applyDiscountsToTests<T extends { servicePrice?: number; discountedValue?: number; discount?: number; price?: number }>(tests: T[]): T[] {
          return tests.map(test => {
               const discount = test.discount || 0;
               // Use servicePrice for services, price for tests
               const base = typeof test.servicePrice === 'number' ? test.servicePrice : (test.price ?? 0);
               const discountedValue = base - discount;
               return { ...test, discountedValue, discount };
          });
     }

     static applyTaxToTests<T extends { discountedValue?: number; servicePrice?: number; price?: number }>(tests: T[], taxValue: number): T[] {
          if (!Array.isArray(tests) || !taxValue || taxValue <= 0) return tests;
          return tests.map(test => {
               const base = typeof test.discountedValue === 'number' ? test.discountedValue : (test.servicePrice ?? test.price ?? 0);
               const taxAmount = Number(((base * taxValue) / 100).toFixed(2));
               return {
                    ...test,
                    amountIncurredDueTax: taxAmount,
                    subtotal: Number((base + taxAmount).toFixed(2))
               };
          });
     }

     static convertTo24Hour(hour: number, period?: string): number {
          if (typeof hour !== 'number') return 0;
          if (hour > 23) return hour % 24;
          if (period?.toLowerCase() === 'pm') return hour === 12 ? 12 : hour + 12;
          else if (period?.toLowerCase() === 'am') return hour === 12 ? 0 : hour;
          return hour;
     }

     static isNightTime(currentHour: number, startHour: number, endHour: number): boolean {
          currentHour = currentHour % 24;
          startHour = startHour % 24;
          endHour = endHour % 24;
          if (startHour > endHour) return currentHour >= startHour || currentHour < endHour;
          return currentHour >= startHour && currentHour < endHour;
     }

     static applyNightAdjustmentsToTests<T extends { discountedValue?: number; servicePrice?: number; price?: number }>(tests: T[], billingsettings: any): T[] {
          if (!Array.isArray(tests) || !billingsettings || !billingsettings.hasNightAdjustment) return tests;
          const { nightAdjustmentValue, nightAdjustmentMode, startTime, endTime } = billingsettings;
          const [startHour] = (startTime || "0:00").split(":").map(Number);
          const [endHour] = (endTime || "0:00").split(":").map(Number);
          const now = new Date();
          const currentHour = now.getHours();
          if (!this.isNightTime(currentHour, startHour, endHour)) return tests;
          return tests.map(test => {
               let base = typeof test.discountedValue === 'number' ? test.discountedValue : (test.servicePrice ?? test.price ?? 0);
               let adjustedValue = base;
               if (nightAdjustmentMode === "percentage") adjustedValue = Number((base + (base * Number(nightAdjustmentValue) / 100)).toFixed(2));
               else if (nightAdjustmentMode === "absolute") adjustedValue = Number((base + Number(nightAdjustmentValue)).toFixed(2));
               return { ...test, discountedValue: adjustedValue };
          });
     }

     async calculateCustomerOutstandingDebt(patientId: number): Promise<number> {
          const conn = await KnexConnection(this.tenantId);
          const result = await conn("billing").where("patientid", patientId).sum("outstanding as totalOutstanding").first();
          return result?.totalOutstanding
     }

     async hasOutstandingDebt(patientId: number): Promise<boolean> {
          return await this.calculateCustomerOutstandingDebt(patientId) > 0;
     }
}
