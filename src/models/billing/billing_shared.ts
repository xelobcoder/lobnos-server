import KnexConnection from "../../database/KnexConnections";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { rowAffected } from "../../hooks/helper";
import BillingStrategy from "../clincians/billingstrategy";
import { BillErrors, MultiTBillingDataShared, MultiTestServicesProvided, MultiTestBillingCartType, EntityType } from "./multi/billing_shared_types";
import { billErrors, BillingValidationResult, serviceCategory, ServiceEntry, servicesProvided, TestCart } from "./billingclientTypes";
import { AddtoTestAscenstionQuery } from "./queries";
import { PrimeBillingPromoCodeRepo } from "./repositories/PrimeBillingPromoCodeRepo";
import { TestAscension } from "../operations/ascension";
import { query } from "winston";
import OutsourcedCases from "../organization/outsourcingOrganization/outsourcedCases";
import { FinanceLedgerService } from "../../services/finance/FinanceLedgerService";
import { ensureFinanceLedgerTables } from "../../services/finance/financeLedgerInit";

export class BillingSharedRepo {
     private static calculateTotalDiscount(data: any[]) {
          return parseFloat(TiifuWorkingClass.reduceListInOF(data, 'discount') || 0)
     }

     private static calculateTotalServicesValue(categoryTrackId: number, data: (TestCart | servicesProvided)[]) {
          if (data.length === 0) return 0;

          if (!(categoryTrackId && serviceCategory[categoryTrackId])) {
               throw new Error(`categoryTrackId ${categoryTrackId} not found`);
          }
          const amount = parseFloat(TiifuWorkingClass.reduceListInOF(data, 'discountedValue'));
          return amount;
     }
     private static amountIncurredDueTaxes(totalServiceCost: any, taxValue: number) {
          return (totalServiceCost) * (taxValue / 100);
     }
     public static calulateTotalPayableServices(
          categoryTrackId: number,
          data: any[],
          taxValue: number,
     ): {
          amountIncurredDueTax: number,
          payable: number,
          totalServiceCost: number,
          totalDiscount: number,
          totalcost: number
     } {
          let totalServiceCost = 0;
          let totalcost = 0;
          let totalDiscount = 0;
          let payable = 0;
          let amountIncurredDueTax = 0;


          totalServiceCost = this.calculateTotalServicesValue(categoryTrackId, data);
          totalDiscount = this.calculateTotalDiscount(data);

          // Correct order: apply discount first, then tax
          const discounted = totalServiceCost - totalDiscount;
          if (taxValue === 0) {
               payable = parseFloat((discounted).toFixed(2));
               totalcost = parseFloat((discounted).toFixed(2));
               amountIncurredDueTax = 0;
          } else {
               amountIncurredDueTax = parseFloat((discounted * (taxValue / 100)).toFixed(2));
               totalcost = parseFloat((discounted + amountIncurredDueTax).toFixed(2));
               payable = totalcost;
          }

          return { amountIncurredDueTax, payable, totalServiceCost, totalDiscount, totalcost };
     }

     // Ensures numeric fields are numbers, mutates the data object
     static ensureNumericFields(data: MultiTBillingDataShared): BillErrors | "" {
          const fields: Array<{ value: any; set: (v: number) => void }> = [
               { value: data.outstanding, set: v => (data.outstanding = v) },
               { value: data.paid, set: v => (data.paid = v) },
               { value: data.payable, set: v => (data.payable = v) },
          ];
          for (const field of fields) {
               if (typeof field.value === "string") {
                    const parsed = parseFloat(field.value);
                    if (isNaN(parsed)) return BillErrors.BadParams;
                    field.set(parsed);
               } else if (typeof field.value === "number") {
                    // ok
               } else if (typeof field.value === "bigint") {
                    field.set(Number(field.value));
               } else {
                    return BillErrors.BadParams;
               }
          }
          return "";
     }

     static async validateBillingRequestBody(billingData: MultiTBillingDataShared, tenantId: number): Promise<true | BillingValidationResult> {
          const { cart, servicesProvided, employeeid, paymentmode, samplingCenter, isPromo, isPromoValid, isPackageUsed, promo, billingSource, patientid, ispromo, promocode } = billingData;

          if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
               return BillingValidationResult.INVALID_CART_OR_SERVICES;
          }
          if (cart.length === 0 && servicesProvided.length === 0) {
               return BillingValidationResult.EMPTY_CART_AND_SERVICES;
          }
          if (!employeeid || typeof employeeid !== "number") {
               return BillingValidationResult.INVALID_EMPLOYEE_ID;
          }

          if (!paymentmode || !(await this.validatePaymentModeId(
               tenantId,
               parseInt(paymentmode.toString(), 10)))) {
               return BillingValidationResult.INVALID_PAYMENT_MODE;
          }

          if (!samplingCenter || typeof samplingCenter !== "number") {
               return BillingValidationResult.MISSING_BRANCH_ID;
          }
          if (this.ensureNumericFields(billingData) !== "") {
               return BillingValidationResult.INVALID_PAYABLE_OR_PAID;
          }
          if (!patientid || typeof patientid !== "number") {
               return BillingValidationResult.MISSING_PATIENT_ID;
          }
          if (!(await this.checkPatientIdExist(patientid, tenantId))) {
               return BillingValidationResult.INVALID_PATIENT_ID;
          }
          if (!serviceCategory[billingSource]) {
               return BillingValidationResult.INVALID_MISSING_BILLING_SOURCE;
          }
          if (billingSource > 1) {
               if (!billingData.entityId || billingData.entityId === 0) {
                    return BillingValidationResult.INVALID_BILLING_SOURCE_MATCH;
               }
          }

          if (isPromo && promo.code && isPromoValid) {
               const promoRepo = new PrimeBillingPromoCodeRepo(tenantId);
               const promoResult = await promoRepo.validatePromoCode(promo.code);
               if (!promoResult.valid) {
                    return BillingValidationResult.INVALID_PROMO_CODE;
               }
          }

          if (isPromo && !promo.code) {
               return BillingValidationResult.INVALID_PROMO_CODE;
          }
          return true
     }

     static async checkValidityOfBillingID(billingid: number, tenantId: number): Promise<boolean> {
          const db = await KnexConnection(tenantId);
          const bill = await db("billing").where("billingid", billingid).first();
          return !!bill;
     }

     static async getOriginalBillingData(billingid: number, tenantId: number): Promise<any> {
          const db = await KnexConnection(tenantId);
          return await db("billing").where("billingid", billingid).first();
     }

     static async canAdjustBilling(billingid: number, tenantId: number): Promise<{ status: boolean; message?: string }> {
          const originalBilling = await this.getOriginalBillingData(billingid, tenantId);
          if (!originalBilling) {
               return { status: false, message: "Original billing not found." };
          }
          if (['voided', 'written-off', 'corrected'].includes(originalBilling.status)) {
               return { status: false, message: `Cannot adjust billing with status: ${originalBilling.status}` };
          }
          return { status: true };
     }

     static applyPromoCodeToAmount(totalpayable: number, promoMethod: 'flat' | 'percentage', promoValue: number) {
          let promoAmount = 0;
          if (promoMethod === 'flat') {
               promoAmount = promoValue;
          } else if (promoMethod === 'percentage') {
               promoAmount = (promoValue / 100) * totalpayable;
          }
          // Defensive: Ensure promoAmount is a valid number
          if (isNaN(promoAmount) || !isFinite(promoAmount)) promoAmount = 0;
          const amountAfterPromo = Math.max(0, totalpayable - promoAmount);
          return { promoValue: promoAmount, amountAfterPromo };
     }
     static async checkPatientIdExist(patientid: number, tenantId: number): Promise<boolean> {
          const db = await KnexConnection(tenantId);
          const result = await db("new_patients").where("patientid", patientid).count<{ count: number }>("*");
          return Number(result[0]['count(*)']) > 0;
     }

     static async validatePaymentModeId(paymentModeId: number, tenantId: number): Promise<boolean> {
          const db = await KnexConnection(tenantId);
          const result = await db("paymentmodes").where("KeyID", paymentModeId).count<{ count: number }>("*");
          return Number(result[0]['count(*)']) > 0;
     }

     static async generateBillingID(patientid: number, tenantId: number, branchid: number, employeeid: number, trx?: any): Promise<number> {
          try {
               const db = trx || (await KnexConnection(tenantId));
               const currentMonth = new Date().getMonth() + 1;
               const currentYear = new Date().getFullYear();
               const currentDay = new Date().getDate();
               const [id] = await db("billing")
                    .insert({
                         patientid,
                         month: currentMonth,
                         year: currentYear,
                         day: currentDay,
                         discount: 0.0,
                         branchid: branchid,
                         lastupdatedby: employeeid,
                    }).returning("billingid");
               return typeof id === "number" ? id : id.billingid;
          } catch (error) {
               if (trx) {
                    await trx.rollback();
               }
               throw new Error("Failed to generate billing ID");
          }

     }

     static async insertBillHistory(tenantId: number, trx: any, billingID: number, paymentMode: any, paid: any, employeeID: any, billingType: any): Promise<boolean> {
          try {
               await ensureFinanceLedgerTables(tenantId);
               const insertion = await trx.raw(
                    "INSERT INTO billinghx(billingid, paymentmode, amount, employeeid, type) VALUES (?, ?, ?, ?, ?)",
                    [billingID, paymentMode, paid, employeeID, billingType]
               );
               const inserted = rowAffected(insertion);

               if (inserted) {
                    const historyId = insertion?.[0]?.insertId || insertion?.insertId;
                    const billingRow = await trx('billing')
                         .select('branchid', 'billedon')
                         .where({ billingid: billingID })
                         .first();

                    if (historyId) {
                         await FinanceLedgerService.recordEntry({
                              tenantId,
                              trx,
                              occurredAt: billingRow?.billedon || new Date(),
                              direction: billingType,
                              amount: Number(paid || 0),
                              accountRef: FinanceLedgerService.mapPaymentModeToAccountRef(paymentMode),
                              sourceModule: 'billing',
                              sourceTable: 'billinghx',
                              sourcePk: Number(historyId),
                              billingid: billingID,
                              employeeid: employeeID ? Number(employeeID) : null,
                              branchid: billingRow?.branchid ? Number(billingRow.branchid) : null,
                         });
                    }
               }

               return inserted;
          } catch (error) {
               console.error("Error inserting billing history:", error);
               return false;
          }
     }

     static async removeDuplicateServiceFromNewCart(services: MultiTestBillingCartType[] | MultiTestServicesProvided[], categoryTrackId: number, billingid: number, isTestCart: boolean, tenantId: number): Promise<any[]> {
          const db = await KnexConnection(tenantId);
          const unique: any[] = [];
          if (isTestCart) {
               for (const item of services as MultiTestBillingCartType[]) {
                    const trackId = item.testid || (item as any).id;
                    const has = await this.hasServiceWithBillingIdAndTrackId(billingid, categoryTrackId, trackId, tenantId);
                    if (!has) unique.push(item);
               }
          } else {
               for (const item of services as MultiTestServicesProvided[]) {
                    const trackId = item.keyid || ((item as any).package_id ?? 0);
                    const has = await this.hasServiceWithBillingIdAndTrackId(billingid, categoryTrackId, trackId, tenantId);
                    if (!has) unique.push(item);
               }
          }
          return unique;
     }

     static async hasServiceWithBillingIdAndTrackId(billingid: number, categoryTrackId: number, trackId: number, tenantId: number): Promise<boolean> {
          const db = await KnexConnection(tenantId);
          const result = await db("dboservices").where({ billingid, categorytrackid: categoryTrackId, trackid: trackId }).count<{ count: number }>("*");
          return Number(result[0].count) > 0;
     }

     // Applies night adjustment logic to a slice of servicesProvided.
     static applyNightAdjustmentToItems(services: servicesProvided[]): servicesProvided[] {
          return services.map(item => {
               if (item.hasNightAdjustment) {
                    const adjValue = item.nightAdjustmentValue || 0;
                    const mode = item.nightAdjustmentMode || "none";
                    if (adjValue !== 0) {
                         if (mode === "percentage") {
                              item.discountedValue += (item.discountedValue * adjValue) / 100;
                         } else if (mode === "absolute") {
                              item.discountedValue += adjValue;
                         }
                    }
               }
               return item;
          });
     }

     static async verificationOfServicesAndNightAdjustment(
          services: servicesProvided[],
          categoryTrackId: number,
          taxValue: number,
          isPackageUsed: boolean,
          tenantId: number
     ): Promise<servicesProvided[]> {
          if (!isPackageUsed) {
               const adjusted = BillingSharedRepo.applyNightAdjustmentToItems(services);
               return await Promise.all(
                    adjusted.map(async item => item)
               );
          } else {
               return services.map(item => item);
          }
     }
     private async verificationAndReformatingOfServics(tenantId: number, item: servicesProvided) {
          const { keyid, discount } = item;
          const serviceItem = await new TiifuWorkingClass('additionalservices').findOne(tenantId, "keyid", keyid);
          const { servicePrice } = serviceItem
          return { discountedValue: servicePrice, discount: discount | 0 }
     }

     async verificationOfServicesAndNightAdjustment(tenantId: number, servicesProvided: servicesProvided[], billingSource: number = 5, taxValue: number, isPackageUsed: boolean) {
          if (!Array.isArray(servicesProvided) || servicesProvided.length === 0) {
               return [];
          }
          let verifyAndReformatServices = servicesProvided;

          if (!isPackageUsed) {
               verifyAndReformatServices = await Promise.all(
                    servicesProvided.map(async (item, index) => {
                         const result = await this.verificationAndReformatingOfServics(tenantId, item);
                         return { ...item, ...result };
                    })
               );

               const applyNightAdjustmentToServiceItems = BillingSharedRepo.applyNightAdjustmentToItems(verifyAndReformatServices as any);

               return applyNightAdjustmentToServiceItems.map((item, index) => {
                    const summary = BillingSharedRepo.calulateTotalPayableServices(billingSource, [item], taxValue);
                    return { ...summary, ...item };
               })

          } else {

               return servicesProvided.map((item, index: number) => {
                    const summary = BillingSharedRepo.calulateTotalPayableServices(billingSource, [item], taxValue);
                    return { ...summary, ...item };
               })
          }



     }

     public static calculateBillingVariablesFinal(
          services: any[],
          test: any[],
          paid: number,
     ): { payable: number, outstanding: number, totalDiscount: number, balance: number, amountIncurredDueTax: number, totalcost: number } {
          const all = [...(services || []), ...(test || [])];

          const payable = all.reduce((sum, item) => sum + (item.totalpayable || 0), 0);
          const totalcost = all.reduce((sum, item) => sum + (item.totalcost || 0), 0);
          const totalDiscount = all.reduce((sum, item) => sum + (item.discount || 0), 0);
          const amountIncurredDueTax = all.reduce((sum, item) => sum + (item.amountIncurredDueTax || 0), 0);
          const outstanding = payable - (paid || 0);
          const balance = paid > payable ? paid - payable : 0;
          return { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost, balance };
     }


     static async applyNightAdjustmentToTestCart(
          tenantId: number,
          trx: any,
          cart: TestCart[],
          billingSource: number,
          entityId?: number
     ): Promise<TestCart[]> {
          let entityType: EntityType = "general";
          let entityVal = 0;
          if (billingSource > 1 && entityId) {
               switch (billingSource) {
                    case 2:
                         entityType = "organization";
                         entityVal = entityId;
                         break;
                    case 3:
                    case 4:
                         entityType = "insurance";
                         entityVal = entityId;
                         break;
                    case 6:
                         entityType = "clinician";
                         entityVal = entityId;
                         break;
               }
          }
          const strategySvc = new BillingStrategy();
          const adjusted: TestCart[] = [];
          for (const item of cart) {
               const price = await strategySvc.getProvidentialTestPrice(tenantId, entityType, entityVal, item.testid, true, trx);
               if (item.discountedValue !== price) {
                    item.discountedValue = price;
               }
               if (item.hasNightAdjustment) {
                    const adjValue = item.nightAdjustmentValue || 0;
                    const mode = item.nightAdjustmentMode || "none";
                    if (adjValue !== 0) {
                         if (mode === "percentage") {
                              item.discountedValue += (item.discountedValue * adjValue) / 100;
                         } else if (mode === "absolute") {
                              item.discountedValue += adjValue;
                         }
                    }
               }
               adjusted.push(item);
          }
          return adjusted;
     }

     static async processTestCart(
          tenantId: number,
          billingData: MultiTBillingDataShared,
          billingID: number,
          taxValue: number,
          taxList: any,
          trx: any,
     ): Promise<any[]> {

          let entityType: EntityType = "general";
          let entityId: number = 0;
          let organizationId = null;
          let clinicianId = null;
          let insuranceId = null;
          let registrationType: string = "self";
          if (billingData.billingSource > 1 && billingData.entityId) {
               entityId = parseInt(billingData.entityId.toString());
               switch (billingData.billingSource) {
                    case 2:
                         entityType = "organization";
                         organizationId = entityId;
                         registrationType = "organization";
                         break;
                    case 4:
                         entityType = "insurance";
                         insuranceId = entityId;
                         registrationType = "insurance";
                         break;
                    case 3:
                         entityType = "insurance";
                         insuranceId = entityId;
                         registrationType = "self";
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
          }
          const strategySvc = new BillingStrategy();
          const result = await Promise.all(
               billingData.cart.map(async (item) => {
                    if (!billingData.isPackageUsed) {
                         if (item.totalcost == null) item.totalcost = item.discountedValue;
                         if (item.payable == null) item.payable = item.discountedValue;
                         // --- Price verification ---
                         const correctPrice = await strategySvc.getProvidentialTestPrice(tenantId, entityType, entityId, item.testid, true, trx);
                         if (item.discountedValue !== correctPrice) {
                              item.discountedValue = correctPrice;
                         }
                         // --- Night adjustment ---
                         const nightAdjustmentApplied = item.hasNightAdjustment
                              ? this.applyNightAdjustmentToItems(
                                   [item]) :
                              [item];
                         item.discountedValue = nightAdjustmentApplied[0].discountedValue;
                    }

                    const summary = BillingSharedRepo.calulateTotalPayableServices(
                         billingData.billingSource,
                         [item],
                         taxValue
                    );

                    const { amountIncurredDueTax, totalcost, totalServiceCost, payable, totalDiscount } = summary;

                    return {
                         billingid: billingID,
                         trackId: item.testid,
                         cost: item.discountedValue,
                         employeeid: billingData.employeeid,
                         serviceCategory: serviceCategory[billingData.billingSource],
                         categoryTrackId: billingData.billingSource,
                         clinicianId,
                         organizationId,
                         registrationType,
                         branchid: billingData.samplingCenter,
                         isoutsourced: item.isOutsourced === true || item.isoutsourced === 1 ? 1 : 0,
                         outsourceid: item.outsourceid || null,
                         serviceAddedOn: new Date(),
                         taxList: typeof taxList === "string" ? taxList : null,
                         taxValue,
                         amountIncurredDueTax: amountIncurredDueTax,
                         taxIncluded: billingData.taxIncluded,
                         discount: totalDiscount,
                         totalcost: totalcost,
                         totalpayable: payable,
                         isNHIS: billingData.billingSource === 4 ? 1 : 0,
                         isPHIS: billingData.billingSource === 3 ? 1 : 0,
                         insuranceid: insuranceId,
                         claimCode: null,
                         hasNightAdjustment: item.hasNightAdjustment === true,
                         nightAdjustmentMode: item.nightAdjustmentMode || "none",
                         nightAdjustmentValue: item.nightAdjustmentValue || 0,
                         isPackageUsed: billingData.isPackageUsed ? 1 : 0,
                         packageid: item.package_id || null
                    };
               })
          );
          return result;
     }



     static async processNonTestServices(
          billingData: MultiTBillingDataShared,
          servicesProvided: servicesProvided & {
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
     ): Promise<ServiceEntry[]> {
          let organizationId = null;
          let clinicianId = null;
          let insuranceId = null;

          const entityId = billingData.entityId ? parseInt(billingData.entityId.toString()) : null;

          switch (billingData.billingSource) {
               case 2:
                    organizationId = entityId;
                    break;
               case 3:
               case 4:
                    insuranceId = entityId;
                    break;
               case 6:
                    clinicianId = entityId;
                    break;
          }
          const { employeeid, samplingCenter, taxIncluded, type, billingSource, isPackageUsed } = billingData;

          return await Promise.all(
               servicesProvided
                    .map(async (item) => {
                         return {
                              billingid: billingID,
                              trackId: item.keyid,
                              cost: item.servicePrice,
                              employeeid,
                              serviceCategory: serviceCategory[5],
                              categoryTrackId: 5,
                              clinicianId,
                              organizationId,
                              registrationType: type,
                              branchid: samplingCenter,
                              isoutsourced: 0,
                              outsourceid: 0,
                              serviceAddedOn: new Date(),
                              taxList,
                              taxValue,
                              amountIncurredDueTax: item.amountIncurredDueTax,
                              taxIncluded,
                              discount: item.totalDiscount,
                              totalcost: item.totalcost,
                              totalpayable: item.payable,
                              isNHIS: billingSource === 4 ? 1 : 0,
                              isPHIS: billingSource === 3 ? 1 : 0,
                              insuranceid: insuranceId || null,
                              claimCode: null,
                              hasNightAdjustment: item.hasNightAdjustment,
                              nightAdjustmentMode: item.nightAdjustmentMode,
                              nightAdjustmentValue: item.nightAdjustmentValue,
                              isPackageUsed: isPackageUsed ? 1 : 0,
                              packageid: item?.packageid || null,
                         };
                    })
          );
     }


     public async mapAndInsertServices(tenantId: number, allEntries: any[], billingid: number, trx?: any) {
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
                         service.paymentstatus,
                         service.paidamount,
                         service.outstanding,
                         service.outsourceprice,
                         service.nhismembershipid ? service.nhismembershipid : null,
                         service.claimscheckcode ? service.claimscheckcode : null,
                         service.relatedbillingid ? service.relatedbillingid : null,
                         service.userAdjustedValue ? service.userAdjustedValue : 0,
                         service.userAdjustmentType ? service.userAdjustmentType : null,
                    ];
               });

               const loadAllServices = await this.loadMultipleServices(servicesMap, billingid, tenantId, trx);
               return loadAllServices;
          } catch (err: any) {
               throw err;
          }
     }
     public async loadMultipleServices(services: any[], billingid: number, tenantId: number, trx?: any) {
          const insertionErrors = [];
          const queryRunner = trx || await KnexConnection(tenantId);

          for (const item of services) {
               try {
                    const [billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid, serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount, totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode, hasNightAdjustment,
                         nightAdjustmentMode, nightAdjustmentValue, isPackageUsed,
                         packageid, paymentstatus, paidamount, outstanding, outsourceprice, nhismembershipid, claimscheckcode, relatedbillingid, userAdjustedValue, userAdjustmentType] = item;

                    const actualDiscount = userAdjustmentType === "discount" ? userAdjustedValue : 0;

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
                         discount: actualDiscount,
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
                         paymentstatus,
                         paidamount,
                         outstanding,
                         outsourceprice,
                         nhismembershipid,
                         claimscheckcode,
                         relatedbillingid,
                         userAdjustedValue,
                         userAdjustmentType
                    });

                    if (outcome && item[5] != 5 && item[1]) {
                         try {
                              const ascensionid = await BillingSharedRepo.AddtoTestAscenstion(tenantId, outcome[0], billingid, item[1], queryRunner);
                              if (ascensionid && typeof ascensionid === "number") {
                                   await TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassCollection', employeeid, queryRunner);
                                   await TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassSampleValidation', employeeid, queryRunner);
                                   await TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassProcessing', employeeid, queryRunner);
                              }
                         } catch (err) {
                              throw new Error(billErrors.unableToLoadTestAscension);
                         }
                    }
               } catch (err) {
                    insertionErrors.push(err);
               }
          }

          console.log("Insertion errors for services:", insertionErrors);
          return insertionErrors;
     }

     public static async AddtoTestAscenstion(tenantId: number, serviceid: number, billingid: number, testid: number, trx?: any): Promise<boolean | number> {
          try {
               if (!billingid || !serviceid || !testid) return false;
               const queryRunner = trx || await KnexConnection(tenantId);
               const currentMonth = new Date().getMonth() + 1;
               const currentYear = new Date().getFullYear();
               const isInserted = await queryRunner.raw(AddtoTestAscenstionQuery, [testid, serviceid, billingid , currentMonth, currentYear]);
              console.log("Ascension insertion result:", isInserted);
               return isInserted[0]?.insertId || false;
          } catch (err) {
               console.error("Error adding to test ascension:", err);
               return false;
          }
     }

     /**
      * Calculates the price of a test/service given all required parameters.
      * This is the backend-only, auditable, DRY utility for price calculation.
      *
      * @param opts - { tenantId, testuid, entity_type, entityid, discount, isNight, taxValue, promo, ... }
      * @returns Detailed breakdown of all calculation steps and final price.
      */
     static async calculateTestOrServicePrice(opts: {
          tenantId: number;
          testuid: number | string;
          entity_type: EntityType;
          entityid: number | string;
          discount?: number; // percent or absolute, as per business rules
          isNight?: boolean;
          nightAdjustmentMode?: 'percentage' | 'absolute' | 'none';
          nightAdjustmentValue?: number;
          taxValue?: number;
          promo?: { method: 'flat' | 'percentage'; value: number };
          trx?: any;
     }) {
          const {
               tenantId, testuid, entity_type, entityid, discount = 0, isNight = false,
               nightAdjustmentMode = 'none', nightAdjustmentValue = 0, taxValue = 0, promo, trx
          } = opts;
          const strategySvc = new BillingStrategy();
          // 1. Fetch base price
          const basePrice = await strategySvc.getProvidentialTestPrice(
               tenantId, entity_type, Number(entityid), Number(testuid), true, trx
          );
          // 2. Night adjustment
          let nightAdjustedPrice = basePrice;
          if (isNight && nightAdjustmentValue && nightAdjustmentMode !== 'none') {
               if (nightAdjustmentMode === 'percentage') {
                    nightAdjustedPrice += (basePrice * nightAdjustmentValue) / 100;
               } else if (nightAdjustmentMode === 'absolute') {
                    nightAdjustedPrice += nightAdjustmentValue;
               }
          }
          // 3. Discount
          let discountedPrice = nightAdjustedPrice;
          if (discount && discount > 0) {
               discountedPrice -= (nightAdjustedPrice * discount) / 100;
          }
          // 4. Promo
          let promoValue = 0;
          let afterPromo = discountedPrice;
          if (promo && promo.value > 0) {
               if (promo.method === 'flat') {
                    promoValue = promo.value;
               } else if (promo.method === 'percentage') {
                    promoValue = (promo.value / 100) * discountedPrice;
               }
               if (isNaN(promoValue) || !isFinite(promoValue)) promoValue = 0;
               afterPromo = Math.max(0, discountedPrice - promoValue);
          }
          // 5. Tax
          let taxAmount = 0;
          let finalPrice = afterPromo;
          if (taxValue && taxValue > 0) {
               taxAmount = parseFloat(((afterPromo * taxValue) / 100).toFixed(2));
               finalPrice = parseFloat((afterPromo + taxAmount).toFixed(2));
          } else {
               finalPrice = parseFloat(afterPromo.toFixed(2));
          }
          // Defensive rounding
          return {
               basePrice: parseFloat(basePrice.toFixed(2)),
               nightAdjustedPrice: parseFloat(nightAdjustedPrice.toFixed(2)),
               discountedPrice: parseFloat(discountedPrice.toFixed(2)),
               promoValue: parseFloat(promoValue.toFixed(2)),
               afterPromo: parseFloat(afterPromo.toFixed(2)),
               taxAmount,
               finalPrice,
               breakdown: {
                    basePrice,
                    nightAdjustedPrice,
                    discountedPrice,
                    promoValue,
                    afterPromo,
                    taxAmount,
                    finalPrice
               }
          };
     }
}
