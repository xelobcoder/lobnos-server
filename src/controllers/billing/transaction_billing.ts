// import { billErrors, BillingValidationResult, IBillNewClient, Pagination, serviceCategory, servicesProvided, TBillingData, TestCart, testServicesProvided } from "./billingclientTypes";
// import {
//      add_additional_service_as_a_service,
//      AddtoTestAscenstionQuery,
//      currentDateBilledClients,
//      deleteAscensionidQuery,
//      deleteBillTransactionQuery,
//      deleteNewBillPaymentHx,
//      insertbillHistoryQuery,
//      insertBillQuery,
//      patientBilledTodayQuery,
//      q_get_today_client_billingid,
//      q_insert_new_services_billing_test,
//      q_update_Billing_Information,
//      updatebillHistoryQuery,
// } from "./queries";
// import { TestAscension } from "../operations/ascension";
// import { Services } from "../services/services";
// import Outsourcing from "../organization/outsourcingOrganization/outsourcing";
// import OrganizationalBilling from "../organization/organizationBilling";
// import { testpanel } from "../../testpanel/list";
// import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
// import { OperationsFailures } from "../operations/types";
// import Organization from "../organization/organization";
// import ApplicationSettings from "../application/appsettings/appset";
// import { updateRefundCashRequestBodyType } from "../../controllers/billing/sales/type";
// import { Refund } from "./RefundClass";
// import { PrimeLimsTablebilling, PrimeLimsTablebillinghx, PrimeLimsTabledbobillingrefundtable, PrimeLimsTabledboservices, PrimeLimsTablepaymentmodes } from "../../database/DatabaseTableSchema";
// import Registration from "../registration/registration";
// import { promisifyQuery, rowAffected } from "../../hooks/helper";
// import PartitionManager from "./partitioning";
// import ClinicianBillingStrategy from "../clincians/clinicianBilling";

// const N = 2;
// export class Billing implements IBillNewClient {
//      readonly patientid: number;

//      constructor(patientid: number) {
//           this.patientid = patientid;
//      }

//      private async insertTestBillingAsAServices(
//           discountedValue: number,
//           testid: number,
//           isOutsourced: boolean,
//           outsourceid = null,
//           totalcost: number,
//           data: testServicesProvided
//      ): Promise<boolean | number> {
//           try {
//                const { billingid, employeeid, serviceCategory, categoryTrackId,
//                     type, clinicianId, organizationId, branchid, taxIncluded = 0, taxList = null, taxValue = 0, amountIncurredDueTax = 0, insuranceId } = data;
//                console.log(serviceCategory);
//                const isPHIS = categoryTrackId == 3 ? 1 : 0

//                const isServiced = await promisifyQuery(q_insert_new_services_billing_test, [
//                     billingid, testid, discountedValue, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, type, branchid, isOutsourced, outsourceid, taxList, amountIncurredDueTax, taxValue, taxIncluded, totalcost, 0, isPHIS, insuranceId, null
//                ]);
//                return rowAffected(isServiced) ? isServiced.insertId : false;
//           } catch (err) {
//                console.log(err)
//                return false;
//           }
//      }



//      public async determineStageOfRefundRequest(data: {
//           serviceid: number;
//           employeeid: number;
//           purpose: string;
//           trackId: number;
//           serviceCategoryName: string;
//           billingid: number;
//           categoryTrackId: number;
//      }): Promise<any> {
//           try {
//                const { categoryTrackId, serviceid, serviceCategoryName } = data;
//                let stage = null;

//                if ([2, 1, 3, 4, 6].includes(categoryTrackId) && serviceCategory[categoryTrackId] === serviceCategoryName) {
//                     const { id: ascensionId } = await new TiifuWorkingClass('test_ascension').findOne('serviceid', serviceid);
//                     if (ascensionId) {
//                          stage = await TestAscension.determineStage(ascensionId);
//                     }
//                }

//                if (categoryTrackId === 5 && serviceCategory[categoryTrackId] === serviceCategoryName) {
//                     stage = await new Services(serviceid).getServiceProgress();
//                }
//                return stage;
//           } catch (err) {
//                console.log(err);
//                return null;
//           }
//      }

//      public async getClientBillingInformation(billingid: number) {
//           if (!billingid) throw new Error("billingid not provided");
//           if (typeof billingid !== "number") throw new TypeError("billingid must be a number");

//           const servicesList = await Services.findAllServicesAssociatedWithBillingId(billingid);

//           if (servicesList.length === 0) return [];

//           const previousRecords = this.diffentiateBilledToIndividualServices(servicesList);

//           return previousRecords
//      }

//      static async totalRecordedPayment(billingid: number): Promise<{ totalDebit: number; totalCredit: number; totalPayment: number; allPayment: number } | boolean | string> {
//           if (!billingid) return OperationsFailures.notFound;

//           const billinghxRecords: PrimeLimsTablebillinghx[] = await new TiifuWorkingClass("billinghx").findMany("billingid", billingid);

//           if (billinghxRecords.length == 0) return false;

//           let totalDebit = 0;
//           let totalCredit = 0;

//           billinghxRecords.forEach((record) => {
//                if (record.type === 'debit') {
//                     totalDebit += parseFloat(record.Amount.toString());
//                } else {
//                     totalCredit += parseFloat(record.Amount.toString());
//                }
//           });

//           totalDebit = parseFloat(totalDebit.toFixed(2));
//           totalCredit = parseFloat(totalCredit.toFixed(2));

//           const totalPayment = parseFloat((totalCredit - totalDebit).toFixed(2));
//           const allPayment = parseFloat((totalDebit + totalCredit).toFixed(2));

//           return {
//                totalDebit,
//                totalCredit,
//                totalPayment,
//                allPayment
//           };
//      }



//      public diffentiateBilledToIndividualServices(servicesList: any) {
//           return Promise.all(
//                servicesList.map(async (item) => {
//                     const addVitalInformation = async function (item) {
//                          const { isoutsourced, trackId, categoryTrackId, serviceAddedOn, outsourceid, organizationId } = item;
//                          let OutSourcingOrganization = [];
//                          let outsouring_organization = null;

//                          if (isoutsourced == 1 && outsourceid) {
//                               OutSourcingOrganization = await new Outsourcing(null, null).getOrganizationBasicInformation(outsourceid);

//                               if (Array.isArray(OutSourcingOrganization) && OutSourcingOrganization.length > 0) {
//                                    outsouring_organization = OutSourcingOrganization[0]['name'];
//                               }
//                          }

//                          switch (categoryTrackId) {
//                               case 1:
//                                    let testname1 = await testpanel.getTestUsingTestid(trackId);
//                                    return { ...item, outsourcingOrganization: outsouring_organization, name: testname1 };

//                               case 5:
//                                    const servicenformation = await new Services(trackId).getAService();
//                                    let testname5 = await testpanel.getTestUsingTestid(trackId);
//                                    return servicenformation.length === 0
//                                         ? { ...item, name: testname5 }
//                                         : { ...item, name: servicenformation[0]['serviceName'], testname: testname5 };

//                               case 2:
//                                    const organizationalBillingName = await new OrganizationalBilling(organizationId).getOrganizationBasic();
//                                    let testName2 = await testpanel.getTestUsingTestid(item.trackId);
//                                    return organizationalBillingName.length === 0
//                                         ? { ...item, name: testName2 }
//                                         : { ...item, outsourcingOrganization: outsouring_organization, organizationName: organizationalBillingName[0]['name'], name: testName2 };

//                               case 3:
//                                    let testname3 = await testpanel.getTestUsingTestid(trackId);
//                                    return { ...item, name: testname3 };

//                               case 6:
//                                    let testname6 = await testpanel.getTestUsingTestid(trackId);
//                                    return { ...item, name: testname6 };

//                               default:
//                                    return [];
//                          }

//                     };
//                     const records = await addVitalInformation(item);
//                     const witnesses = await Refund.getservicesRefundWithness(item.serviceid);
//                     return { ...records, witnesses };
//                })
//           )
//      }

//      public async getTransactionBillData(billingid: number) {
//           return await promisifyQuery(`SELECT * FROM billing WHERE billingid  =? `, [billingid]);
//      }

//      public async getBranchDayBilledClients(branchid: number, { count = 10, page = 1 }: Pagination): Promise<[]> {
//           const currentDate = new Date();
//           const currentYear = currentDate.getFullYear();
//           const month = currentDate.getMonth();
//           const day = currentDate.getDate();
//           const result: [] = await promisifyQuery(currentDateBilledClients, [currentYear, month, day, branchid]);
//           return result;
//      }



//      private static calculateBillingVariablesFinal(
//           services: any[],
//           test: any[],
//           taxValue: number,
//           serviceCategoryTrackId: number,
//           testCategoryTrackId: number,
//           paid: number
//      ): { payable: number, outstanding: number, totalDiscount: number, amountIncurredDueTax: number, totalcost: number } {

//           const payableofTest = Billing.calulateTotalPayableServices(testCategoryTrackId, test as any, taxValue);
//           const payableofServices = Billing.calulateTotalPayableServices(serviceCategoryTrackId, services as any, taxValue);

//           const { amountIncurredDueTax: a1, totalDiscount: d1, payable: p1, totalServiceCost: t1, totalcost: v1 } = payableofTest;
//           const { amountIncurredDueTax: a2, totalDiscount: d2, payable: p2, totalServiceCost: t2, totalcost: v2 } = payableofServices;

//           let payable = parseFloat((p1 + p2).toFixed(2));
//           let amountIncurredDueTax = parseFloat((a1 + a2).toFixed(2));
//           let totalDiscount = parseFloat((d1 + d2).toFixed(2));
//           let outstanding = parseFloat((payable - paid).toFixed(2));
//           let totalcost = parseFloat((v1 + v2).toFixed(2));

//           return { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost };
//      }

//      private async billClient(data: TBillingData, taxValue: number): Promise<number | boolean> {
//           try {
//                const { patientid, paid, status, cart, servicesProvided, billingSource, organizationId, insuranceId, clinicianId } = data;

//                const values = await Promise
//                     .all(cart.map(async (item, index) => {

//                          return await this.verificationAndReformatingOfTestAndPrice(item, billingSource, { organizationId, insuranceId, clinicianId })
//                     }));

//                const services = await Promise
//                     .all(servicesProvided.map(async (item, index) => {
//                          return await this.verificationAndReformatingOfServics(item)
//                     }));


//                const finalValues = Billing.calculateBillingVariablesFinal(services as any, values as any, taxValue, 5, billingSource, paid);

//                const { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost } = finalValues;


//                const insertionValues = [patientid, paid, payable, outstanding, totalDiscount, amountIncurredDueTax, status, totalcost]
//                const { insertId } = await promisifyQuery(insertBillQuery, insertionValues);

//                return insertId;
//           } catch (err) {
//                console.log(err)
//                throw new Error(billErrors.error);
//           }
//      }

//      public async isCompleteFlow(): Promise<boolean> {
//           const settings = await promisifyQuery(`SELECT * FROM applicationsettings`);
//           return settings.length == 0 ? false : settings[0]["completeFlow"] == 1;
//      }


//      private static async updateBillingInformation(
//           payable: number,
//           paid: number,
//           amountIncurredDueTax: number,
//           outstanding: number,
//           balance: number,
//           discount: number,
//           billingid: number,
//           totalRefunded: number,
//           totalcost: number,
//           transactioncost: number
//      ) {
//           const values = [paid, payable, outstanding, discount, amountIncurredDueTax, balance, totalRefunded, totalcost, transactioncost, billingid];

//           const result = await promisifyQuery(q_update_Billing_Information, values);
//           return rowAffected(result);
//      }


//      public async updateBillingHistory(paymentmode: number, billingid: number, amount: number): Promise<any> {
//           const values: [number, number, number] = [paymentmode, amount, billingid];
//           return await promisifyQuery(updatebillHistoryQuery, values);
//      }

//      public async insertBillingHistory(paymentmode: number, billingid: number, amount: number, employeeid: number, type = "credit"): Promise<any> {
//           const values: [number, number, number, number, string] = [billingid, paymentmode, amount, employeeid, type];
//           return await promisifyQuery(insertbillHistoryQuery, values);
//      }

//      public async deleteBillingHistory(billingid: number) {
//           if (billingid) return false;
//           return await promisifyQuery(deleteNewBillPaymentHx, [billingid]);
//      }


//      public async updateApprovalStatus(ascensionId: number): Promise<any> {
//           try {
//                const query = `UPDATE samplestatus SET approvalstatus = 1 WHERE ascensionid = ?`;
//                const values = [ascensionId];
//                return promisifyQuery(query, values);
//           } catch (err) {
//                throw new Error(err);
//           }
//      }


//      public async deleteTestAscension(serviceid: number, testid: number): Promise<boolean> {
//           const result = await promisifyQuery(deleteAscensionidQuery, [serviceid, testid]);
//           return rowAffected(result);
//      }


//      public async haveBeenBilledToday(patientid: number): Promise<boolean> {
//           const result = await promisifyQuery(patientBilledTodayQuery, [patientid]);
//           return !(result[0]["count"] > 0);
//      }

//      public async getClientTodayBillingid(patientid: number): Promise<number | boolean> {
//           const result = await promisifyQuery(q_get_today_client_billingid, [patientid]);
//           if (result.length == 0) return false;
//           return result[0]['billingid']
//      }


//      public async AddtoTestAscenstion(serviceid: number, billingid: number, testid: number): Promise<boolean | number> {
//           try {
//                if (!billingid || !serviceid || !testid) return false;
//                const isInserted = await promisifyQuery(AddtoTestAscenstionQuery, [testid, serviceid, billingid]);
//                return isInserted.insertId;
//           } catch (err) {
//                if (err && err.code && err.errno == 1526 && err.code == 'ER_NO_PARTITION_FOR_GIVEN_VALUE'.trim()) {
//                     const currentYear = new Date().getFullYear();
//                     await new PartitionManager("test_ascension", "asc").addYearPartition(currentYear);
//                }
//                return false;
//           }
//      }


//      public async deleteBillTransaction(billingid: number): Promise<any> {
//           return await promisifyQuery(deleteBillTransactionQuery, [billingid]);
//      }


//      async cleanUpRecordedPaymentHx(billingid: number): Promise<void> {
//           await promisifyQuery(deleteNewBillPaymentHx, [billingid]);
//      }


//      private static async inCompleteFlowTestAscensionUpdate(employeeid: number, date: Date, ascensionId: number) {
//           try {
//                // const testAscensionClass = new TestAscension(ascensionId);
//                // await testAscensionClass.updateTestAscensionStatus("collectionStartDate", new Date(), employeeid);
//                // await testAscensionClass.updateTestAscensionStatus("collectionEndDate", new Date(), employeeid);
//                // await new Billing(null).updateApprovalStatus(ascensionId);
//                // await testAscensionClass.updateTestAscensionStatus("processingStartDate", new Date(), employeeid);
//                // await testAscensionClass.updateTestAscensionStatus("processingEndDate", new Date(), employeeid);
//           } catch (err) {
//                throw err;
//           }
//      }

//      async loadServiceBillingAsService(data: {
//           billingid: number,
//           employeeid: number,
//           trackid: number,
//           serviceCategory: string,
//           categoryTrackId: number,
//           cost: number,
//           branchid: number
//           taxValue: number,
//           taxList: any,
//           includeTax: number,
//           discount: number
//      }) {
//           const { cost, trackid, employeeid, branchid, serviceCategory, categoryTrackId, billingid, taxList, taxValue, includeTax, discount } = data;

//           let amountIncurredDueTax = Billing.amountIncurredDueTaxes(cost, taxValue);
//           let totalcost = parseFloat((amountIncurredDueTax + cost).toString())
//           totalcost = parseFloat(totalcost.toFixed(2))
//           return await promisifyQuery(add_additional_service_as_a_service, [billingid, trackid, employeeid, categoryTrackId, serviceCategory, branchid, cost, taxValue, taxList, includeTax, amountIncurredDueTax, discount, totalcost])
//      }




//      private static getBilledTaxValues(packet) {
//           if (packet.hasOwnProperty("taxList") === false) return 0;
//           const { taxList } = packet;

//           let parsedPacketTaxList = JSON.parse(taxList);

//           if (Array.isArray(parsedPacketTaxList) && parsedPacketTaxList.length > 0) {
//                parsedPacketTaxList = parsedPacketTaxList.reduce((a, b) => a + b.value, 0)
//           }

//           return parsedPacketTaxList;
//      }

//      public static async checkValidityOfBillingid(billingid: number): Promise<boolean> {
//           const result = await new TiifuWorkingClass('billing').findOne("billingid", billingid);
//           return result && result.billingid == billingid;
//      }


//      public static async getTotalPriceFromSavedServices(
//           billingid: number,
//           refundInclusive: boolean
//      ): Promise<{
//           totalDiscount: number;
//           totalCost: number;
//           totalAmountIncurredDueTax: number;
//           totalPayable: number;
//           totalRefunded: number;
//           transactioncost: number;
//      }> {
//           const rows: (PrimeLimsTabledboservices & PrimeLimsTabledbobillingrefundtable)[] = refundInclusive
//                ? await Services.findAllServicesAssociatedWithBillingId(billingid)
//                : await Services.findAllServicesAssociatedWithBillingIdExclusive(billingid);

//           if (rows.length === 0) {
//                return {
//                     totalCost: 0,
//                     totalAmountIncurredDueTax: 0,
//                     totalDiscount: 0,
//                     totalRefunded: 0,
//                     totalPayable: 0,
//                     transactioncost: 0
//                };
//           }

//           let totalCost = 0;
//           let totalDiscount = 0;
//           let totalAmountIncurredDueTax = 0;
//           let totalRefunded = 0;
//           let transactioncost = 0;

//           for (const row of rows) {
//                const totalcost = parseFloat(row.totalcost?.toString() || '0');
//                const amountIncurredDueTax = parseFloat(row.amountIncurredDueTax?.toString() || '0');
//                const discount = parseFloat(row.discount?.toString() || '0');


//                const isServiceRefunded =
//                     row.isRefundApproved === 1 && row.isRefundCompleted === 1 && row.isRefundInitiated === 1;

//                if (isServiceRefunded) {
//                     totalRefunded += totalcost;
//                } else {
//                     totalCost += totalcost;
//                     totalDiscount += discount;
//                     totalAmountIncurredDueTax += amountIncurredDueTax;
//                }
//           }

//           const totalPayable = totalCost - totalDiscount;
//           transactioncost = totalCost + totalRefunded;

//           return {
//                totalCost: Number(totalCost.toFixed(2)),
//                totalAmountIncurredDueTax: Number(totalAmountIncurredDueTax.toFixed(2)),
//                totalDiscount: Number(totalDiscount.toFixed(2)),
//                totalRefunded: Number(totalRefunded.toFixed(2)),
//                totalPayable: Math.max(Number(totalPayable.toFixed(2)), 0),
//                transactioncost: Number(transactioncost.toFixed(2))
//           };
//      }



//      private async loadTestAscensionMultiple(data: TestCart[], categoryTrackId: number, servicesBillingData: testServicesProvided, includeTax: number, taxValue: number, taxList: any) {
//           if (data.length === 0) return false;
//           let verifiedTestPricing = [];
//           const { billingid, organizationId, clinicianId, insuranceId } = servicesBillingData;

//           for (const item of data) {
//                try {
//                     var { amountIncurredDueTax, discountedValue, serviceid, trackId, isOutsourced, outsourceid, ascensionId: prevAscensionId } = await this.verificationAndReformatingOfTestAndPrice(item, categoryTrackId, { insuranceId, organizationId, clinicianId });

//                     let ascensionId = null;

//                     if (includeTax == 1) {
//                          amountIncurredDueTax = discountedValue * (taxValue / 100);
//                     }
//                     let loadingValues = { ...servicesBillingData, taxIncluded: includeTax, taxValue, amountIncurredDueTax, taxList }

//                     const totalCost = amountIncurredDueTax + discountedValue;

//                     serviceid = await this.insertTestBillingAsAServices(discountedValue, trackId, isOutsourced, outsourceid, totalCost, loadingValues);


//                     if (typeof serviceid == "boolean" && !serviceid) {
//                          throw new Error('services not inserted');
//                     }

//                     if (typeof serviceid == 'number') {
//                          ascensionId = await this.AddtoTestAscenstion(serviceid, billingid, trackId);
//                     }

//                     if (!ascensionId) throw new Error("test ascensionid not added");

//                     // this would have made the sample,processing states to be updated to collected
//                     // this.updateAscensionStates(isItCompleteFlow, ascensionId, employeeid, verifiedTestPricing, trackId, discountedValue);
//                } catch (error) {
//                     throw error
//                }
//           }

//           return verifiedTestPricing;
//      }

//      private async verificationAndReformatingOfServics(item: servicesProvided) {
//           const { keyid, discount } = item;
//           const serviceItem = await new TiifuWorkingClass('additionalservices').findOne("keyid", keyid);
//           const { servicePrice } = serviceItem
//           return { discountedValue: servicePrice, discount: discount | 0 }
//      }

//      private async verificationAndReformatingOfTestAndPrice(item: TestCart, categoryTrackId: number, associate: {
//           organizationId: number | null,
//           insuranceId: number | null,
//           clinicianId: number | null
//      }) {
//           try {
//                const { organizationId, insuranceId, clinicianId } = associate

//                const { testid, id, organization, discount } = item;
//                const trackId = testid ? testid : id;

//                let outsourceid = null;
//                let isOutsourced = false;
//                let price = null;
//                let serviceid = null;
//                let amountIncurredDueTax = 0;
//                let ascensionId = null;



//                const hasOrganization = organization && organization.hasOwnProperty("outsourceid");

//                if (hasOrganization) {
//                     outsourceid = organization.outsourceid;
//                     isOutsourced = true;
//                }

//                if (categoryTrackId == 1) {
//                     const testpanel = await new TiifuWorkingClass("test_panels").findOne("id", trackId);
//                     price = testpanel['price'];
//                }

//                if (categoryTrackId == 2) {
//                     price = await this.getTestOrganizationPriceValue(organizationId, trackId, price);
//                }

//                if (categoryTrackId === 3) {
//                     const { discountedValue, isoutsourced } = await new ClinicianBillingStrategy(insuranceId).getStrategySingleTestValue(insuranceId, 'phis', trackId)
//                     price = discountedValue
//                     isOutsourced = isoutsourced == 1
//                     outsourceid = isoutsourced
//                }
//                if (categoryTrackId === 6) {
//                     const { discountedValue, isoutsourced } = await new ClinicianBillingStrategy(clinicianId).getStrategySingleTestValue(clinicianId, 'clinicians', trackId)

//                     if (discountedValue >= 0) {
//                          price = discountedValue
//                          isOutsourced = isoutsourced == 1
//                          outsourceid = isoutsourced
//                     }
//                }

//                let parsedDiscount = discount ? discount : 0;

//                return { amountIncurredDueTax, discountedValue: price, serviceid, trackId, isOutsourced, outsourceid, ascensionId, discount: parsedDiscount };
//           } catch (error) {
//                throw error
//           }
//      }

//      private updateAscensionStates(isItCompleteFlow: boolean, ascensionId: any, employeeid: number, verifiedTestPricing: any[], trackId: number, price: any) {
//           try {
//                if (isItCompleteFlow === false && ascensionId) {
//                     Billing.inCompleteFlowTestAscensionUpdate(employeeid, new Date(), ascensionId);
//                }

//                verifiedTestPricing.push({ testid: trackId, price });
//           } catch (error) {
//                throw error
//           }
//      }

//      private static calculateTotalServicesValue(categoryTrackId: number, data: (TestCart | servicesProvided)[]) {
//           if (data.length === 0) return 0;

//           if (!(categoryTrackId && serviceCategory[categoryTrackId])) throw new Error(`categoryTrackId ${categoryTrackId} not found`);
//           const amount = parseFloat(TiifuWorkingClass.reduceListInOF(data, 'discountedValue') || 0);
//           return amount;
//      }

//      private static calculateTotalDiscount(data: any[]) {
//           return parseFloat(TiifuWorkingClass.reduceListInOF(data, 'discount') || 0)
//      }


//      private static calulateTotalPayableServices(
//           categoryTrackId: number,
//           data: any[],
//           taxValue: number
//      ): {
//           amountIncurredDueTax: number,
//           payable: number,
//           totalServiceCost: number,
//           totalDiscount: number,
//           totalcost: number
//      } {
//           let totalServiceCost = 0;
//           let totalcost = 0;
//           let totalDiscount = 0;
//           let payable = 0;
//           let amountIncurredDueTax = 0;

//           totalServiceCost = this.calculateTotalServicesValue(categoryTrackId, data);
//           totalDiscount = this.calculateTotalDiscount(data);
//           console.log(totalServiceCost, totalDiscount, "services")

//           if (taxValue === 0) {
//                payable = parseFloat((totalServiceCost - totalDiscount).toFixed(2));
//                totalcost = parseFloat(totalServiceCost.toFixed(2));
//           } else {
//                amountIncurredDueTax = parseFloat(Billing.amountIncurredDueTaxes(totalServiceCost, taxValue).toFixed(2));
//                totalcost = parseFloat((totalServiceCost + amountIncurredDueTax).toFixed(2));
//                payable = parseFloat((totalServiceCost + amountIncurredDueTax - totalDiscount).toFixed(2));
//           }

//           return { amountIncurredDueTax, payable, totalServiceCost, totalDiscount, totalcost };
//      }


//      private static amountIncurredDueTaxes(totalServiceCost: any, taxValue: number) {
//           return (totalServiceCost) * (taxValue / 100);
//      }

//      private async getTestOrganizationPriceValue(organizationId: number, trackId: number, price: any) {
//           try {
//                const organization = new Organization(organizationId);
//                const isValidOrganization = await organization.isProvidedOrganizationIdValid(organizationId);

//                if (!isValidOrganization)
//                     throw new Error(OperationsFailures.notFound);

//                const { testList } = await new OrganizationalBilling(organizationId).getOrganizationalBilling();

//                if (Array.isArray(testList) && testList.length > 0) {
//                     const filterTest = testList.filter((a, index) => a['testid'] === trackId);

//                     if (filterTest.length == 0) throw new Error(OperationsFailures.notFound);

//                     price = filterTest[0]['discountedValue'];
//                }
//                return price;
//           } catch (error) {
//                throw error
//           }
//      }
//      public static async updatePreviouslyBilledClientAfterRefundConcluded(
//           records: Partial<updateRefundCashRequestBodyType>
//      ): Promise<boolean> {
//           const { billingid } = records;

//           const isBillingIdValid: boolean = await Billing.checkValidityOfBillingid(billingid);

//           if (!isBillingIdValid) return false;

//           const {
//                totalCost,
//                totalPayable,
//                totalRefunded,
//                transactioncost,
//                totalAmountIncurredDueTax,
//                totalDiscount
//           } = await this.getTotalPriceFromSavedServices(billingid, true);

//           const previousBillingRecord: PrimeLimsTablebilling[] = await new Billing(null).getTransactionBillData(billingid);
//           if (previousBillingRecord.length === 0) return false;

//           let paid = previousBillingRecord[0]['paid']

//           const billinghx = await this.totalRecordedPayment(billingid);

//           if (typeof billinghx != 'string' && typeof billinghx != 'boolean') {
//                paid = billinghx.totalPayment;
//           }

//           const newRefundableAmount = parseFloat(totalRefunded.toFixed(2));

//           let newOutstandingAmount = 0;
//           let newBalanceAmount = 0;

//           if (paid >= totalPayable) {
//                newBalanceAmount = paid - totalPayable;
//           } else {
//                newOutstandingAmount = totalPayable - paid;
//           }



//           try {
//                const updateSuccess: boolean = await Billing.updateBillingInformation(
//                     totalPayable,
//                     paid,
//                     totalAmountIncurredDueTax,
//                     newOutstandingAmount,
//                     newBalanceAmount,
//                     totalDiscount,
//                     billingid,
//                     newRefundableAmount,
//                     totalCost,
//                     transactioncost);
//                return updateSuccess;

//           } catch (err) {
//                throw err;
//           }

//      }




//      private static async removeDuplicateServiceFromNewCart(services: [], categoryTrackId: number, billingid: number) {
//           let unique = [];

//           for (let i = 0; i < services.length; i++) {
//                const { id, testid, keyid } = services[i];
//                const trackId = testid ? testid : id ? id : keyid;
//                const hasAlreadyBeenBilled = await Services.hasServiceWithBillingIdAndTrackId(billingid, categoryTrackId, trackId);

//                if (!hasAlreadyBeenBilled) unique.push(services[i]);
//           }
//           return unique;
//      }


//      public async BillNewTransaction(billingData: TBillingData): Promise<boolean | string> {
//           let isHistoryAdded = false;
//           let billingid = undefined;
//           let insertionErrors = [];
//           let taxList = null;

//           try {
//                const billdataValidation = await Billing.validateBillingRequestBody(billingData);

//                if (billdataValidation !== true) {
//                     return billdataValidation;
//                }

//                const { includeTax, taxValue } = await new ApplicationSettings().getAppBillSettings();
//                billingid = await this.billClient(billingData, taxValue);

//                if (typeof billingid == "boolean" || !billingid) return billErrors.failed;

//                const { paymentmode, employeeid, billingSource, type, clinicianId, organizationId, samplingCenter, cart, insuranceId } = billingData;

//                const servicesBillingData = {
//                     billingid,
//                     paymentmode,
//                     employeeid,
//                     serviceCategory: serviceCategory[billingSource],
//                     categoryTrackId: billingSource,
//                     clinicianId,
//                     organizationId,
//                     insuranceId,
//                     type,
//                     branchid: samplingCenter,
//                }

//                if (includeTax === 1) {
//                     taxList = await new TiifuWorkingClass("tax").findMany("apply", 'yes');
//                     taxList = JSON.stringify(taxList);
//                }

//                // load  test ascension 
//                await this.loadTestAscensionMultiple(cart, billingSource, servicesBillingData as any, includeTax, taxValue, taxList);
//                // load services to be provided
//                await this.loadMultipleServices(billingData, employeeid, samplingCenter, billingid, taxValue, includeTax, taxList, insertionErrors);
//                // insert method of payment to the billing table 
//                isHistoryAdded = rowAffected(await this.insertBillingHistory(billingData.paymentmode, billingid, billingData.paid, employeeid));
//                return true;
//           } catch (err) {
//                if (billingid) {
//                     await this.cleanUpFailedbillingProcess(billingid);
//                }
//                if (err?.code && err?.errno == 1526) {
//                     console.log(true)
//                     const currentYear = new Date().getFullYear();
//                     await new PartitionManager("billing", 'billing').addYearPartition(currentYear);
//                }

//                return billErrors.error;
//           }
//      }

//      private static async validatePaymentModeId(id: number): Promise<boolean> {
//           const data: PrimeLimsTablepaymentmodes[] = await new TiifuWorkingClass("paymentmodes").findMany("KeyID", id);
//           return Array.isArray(data) && data.length > 0;
//      }

//      private static async validateBillingRequestBody(
//           billingData: TBillingData
//      ): Promise<boolean | BillingValidationResult> {
//           const {
//                cart, servicesProvided, employeeid, paymentmode, samplingCenter, billingSource, paid, discount, patientid, payable, insuranceId, clinicianId
//           } = billingData;

//           if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
//                return BillingValidationResult.INVALID_CART_OR_SERVICES;
//           }

//           if (cart.length === 0 && servicesProvided.length === 0) {
//                return BillingValidationResult.EMPTY_CART_AND_SERVICES;
//           }

//           if (!employeeid || typeof employeeid !== "number") {
//                return BillingValidationResult.INVALID_EMPLOYEE_ID;
//           }

//           if (!paymentmode || !(await this.validatePaymentModeId(parseInt(paymentmode.toString(), 10)))) {
//                return BillingValidationResult.INVALID_PAYMENT_MODE;
//           }

//           if (!samplingCenter) {
//                return BillingValidationResult.MISSING_BRANCH_ID;
//           }

//           if (isNaN(payable) || isNaN(paid) || isNaN(discount)) {
//                return BillingValidationResult.INVALID_PAYABLE_OR_PAID;
//           }

//           if (!patientid) {
//                return BillingValidationResult.MISSING_PATIENT_ID;
//           }

//           if (!(await Registration.checkPatientIdExist(patientid))) {
//                return BillingValidationResult.INVALID_PATIENT_ID
//           }

//           if (!billingSource || !serviceCategory[billingSource]) {
//                return BillingValidationResult.INVALID_MISSING_BILLING_SOURCE
//           }


//           if (billingSource && billingSource == 5 && !clinicianId) {
//                return BillingValidationResult.INVALID_BILLING_SOURCE_MATCH
//           }

//           if (billingSource && billingSource == 4 && !insuranceId) {
//                return BillingValidationResult.INVALID_BILLING_SOURCE_MATCH
//           }

//           function ensureNumericFields(data: TBillingData): boolean | BillingValidationResult {
//                const fieldsToConvert = ["outstanding", "paid", "payable"];
//                for (const field of fieldsToConvert) {
//                     const value = data[field];
//                     if (typeof value === "string") {
//                          const parsedValue = parseFloat(value);
//                          if (isNaN(parsedValue)) {
//                               return BillingValidationResult.INVALID_PAYABLE_OR_PAID;
//                          }
//                          data[field] = parsedValue;
//                     } else if (typeof value !== "number") {
//                          return BillingValidationResult.INVALID_PAYABLE_OR_PAID;
//                     }
//                }
//                return true;
//           }

//           const isNumericForNumerics = ensureNumericFields(billingData);

//           if (isNumericForNumerics != true) {
//                return isNumericForNumerics;
//           }

//           return true;
//      }




//      public async updatePreviousTransaction(billingData: TBillingData, billingid: number): Promise<boolean | string> {
//           try {

//                if (!billingid) { throw new Error("billingid not provided") }

//                if (typeof billingid != "number") { throw new TypeError("billingid not provided"); }

//                const { cart, servicesProvided = [] } = billingData;

//                const validBillingIdProvided = await Billing.checkValidityOfBillingid(billingid);

//                const billdataValidation = await Billing.validateBillingRequestBody(billingData);

//                if (billdataValidation !== true) {
//                     return billdataValidation;
//                }

//                if (!validBillingIdProvided) return OperationsFailures.notFound;

//                if (!Array.isArray(cart) || !Array.isArray(servicesProvided) || (cart.length <= 0 && servicesProvided.length <= 0)) {
//                     return OperationsFailures.invalidResponseBodyParams;
//                }

//                const { paymentmode,
//                     employeeid,
//                     billingSource,
//                     type,
//                     clinicianId,
//                     organizationId,
//                     samplingCenter,
//                     insuranceId } = billingData;

//                const parsedPayment = parseFloat(billingData.paid.toString());
//                const currentPayment = parseFloat(parsedPayment.toFixed(2));

//                const servicesBillingData = {
//                     billingid,
//                     paymentmode,
//                     employeeid,
//                     serviceCategory: serviceCategory[billingSource],
//                     categoryTrackId: billingSource,
//                     clinicianId,
//                     organizationId,
//                     type,
//                     branchid: samplingCenter,
//                }


//                let insertionErrors = [];
//                let isHistoryAdded = false;

//                let taxList = null;
//                const { includeTax, taxValue } = await new ApplicationSettings().getAppBillSettings();

//                if (includeTax === 1) {
//                     taxList = await new TiifuWorkingClass("tax").findMany("apply", 'yes');
//                     taxList = JSON.stringify(taxList);
//                }

//                let testCart = await Billing.removeDuplicateServiceFromNewCart(cart as any, billingSource, billingid);

//                let testServices = await Billing.removeDuplicateServiceFromNewCart(servicesProvided as any, billingSource, billingid);

//                if (testCart.length === 0 && testServices.length === 0) {
//                     return OperationsFailures.allRequestedServicesAlreadyExistForThisTransaction
//                }

//                const {
//                     totalAmountIncurredDueTax,
//                     totalCost,
//                     transactioncost,
//                     totalDiscount,
//                     totalRefunded,
//                     totalPayable
//                } = await Billing.getTotalPriceFromSavedServices(billingid, true);

//                const previousBilling = await this.getTransactionBillData(billingid);

//                if (previousBilling && Array.isArray(previousBilling) && previousBilling.length > 0) {
//                     let paid = previousBilling[0]['paid'];
//                     paid = parseFloat(paid).toFixed(2);

//                     const billinghx = await Billing.totalRecordedPayment(billingid);

//                     console.log(paid, billinghx);

//                     if (typeof billinghx != 'string' && typeof billinghx != 'boolean') {
//                          paid = billinghx.totalPayment;
//                          paid = isNaN(parseFloat(paid)) ? 0 : parseFloat(paid).toFixed(2);
//                     }

//                     const {
//                          totalDiscount: newTotalDiscount,
//                          payable: newPayable,
//                          amountIncurredDueTax: newAmountIncurredTaxAmount,
//                          totalcost: newTotalcost
//                     } = Billing.calculateBillingVariablesFinal(
//                          testServices,
//                          testCart,
//                          taxValue,
//                          5,
//                          billingSource,
//                          billingData.paid
//                     );


//                     paid = parseFloat(paid)
//                     const fcurrentDiscount = newTotalDiscount + totalDiscount
//                     const fcurrentAmountDueTax = newAmountIncurredTaxAmount + totalAmountIncurredDueTax
//                     const ftotalcost = newTotalcost + totalCost;
//                     let ftotalPayable = newPayable + totalPayable;
//                     ftotalPayable = parseFloat(ftotalPayable.toFixed(2))
//                     const ftotalRefunded = totalRefunded;
//                     const ftotalPaymentMade = parseFloat(paid + currentPayment);
//                     let balanceAmount = 0;
//                     let outstanding = 0;
//                     const newTransactioncost = transactioncost + newTotalcost;

//                     let fpayDiff = ftotalPayable - ftotalPaymentMade;
//                     fpayDiff = parseFloat(fpayDiff.toFixed(2));

//                     if (ftotalPaymentMade > ftotalPayable) {
//                          balanceAmount = fpayDiff;
//                     } else {
//                          outstanding = fpayDiff;
//                     }
//                     console.log(ftotalPaymentMade, ftotalPayable)
//                     if (ftotalPaymentMade > ftotalPayable) {
//                          return OperationsFailures.paymentExceedsPayableAmount;
//                     }

//                     await this.loadTestAscensionMultiple(testCart, billingSource, servicesBillingData as any, includeTax, taxValue, taxList);


//                     await this.loadMultipleServices({ ...billingData, servicesProvided: testServices }, employeeid, samplingCenter, billingid, taxValue, includeTax, taxList, insertionErrors);


//                     const isUpdated = await Billing.updateBillingInformation(ftotalPayable, ftotalPaymentMade, fcurrentAmountDueTax, outstanding, balanceAmount, fcurrentDiscount, billingid, ftotalRefunded, ftotalcost, newTransactioncost);

//                     isHistoryAdded = rowAffected(await this.insertBillingHistory(billingData.paymentmode, billingid, billingData.paid, employeeid, 'credit'));

//                     return isUpdated;
//                }
//           } catch (error) {
//                console.log(error);
//           }
//      }

//      private async multipleServicesAscensionProcess(cart: TestCart[], insertionErrors: any[], servicesBillingData: {
//           billingid: any;
//           paymentmode: number;
//           employeeid: number;
//           serviceCategory: any;
//           categoryTrackId: number;
//           insuranceId: number,
//           clinicianId: number;
//           organizationId: number;
//           type: string;
//           branchid: number;
//           taxValue: number,
//           amountIncurredDueTax: number,
//           taxIncluded: number,
//           taxList: [] | string
//      }, billingid: any, isItCompleteFlow: boolean, employeeid: number) {
//           for (let i = 0; i < cart.length && insertionErrors.length == 0; i++) {
//                let ascensionId = null;
//                const { discountedValue, testid, id, organization } = cart[i];
//                const correctTestid = testid ? testid : id;
//                let outsourceid = null;
//                let isOutsourced = false;
//                if (organization && typeof organization == "object" && organization.hasOwnProperty('outsourceid')) {
//                     outsourceid = organization.outsourceid;
//                     isOutsourced = true;
//                }
//                const isServicesDullyInserted = await this.insertTestBillingAsAServices(discountedValue, correctTestid, isOutsourced, outsourceid, 0, servicesBillingData);

//                if (typeof isServicesDullyInserted == "boolean" && !isServicesDullyInserted) {
//                     insertionErrors.push(correctTestid);
//                     throw new Error('services not inserted');
//                }

//                if (typeof isServicesDullyInserted == 'number') {
//                     ascensionId = await this.AddtoTestAscenstion(isServicesDullyInserted, billingid, correctTestid);
//                }

//                if (!ascensionId) throw new Error("test ascensionid not added");

//                if (isItCompleteFlow === false && ascensionId) {
//                     Billing.inCompleteFlowTestAscensionUpdate(employeeid, new Date(), ascensionId);
//                }
//           }
//      }

//      private async cleanUpFailedbillingProcess(billingid: number) {
//           await this.deleteBillTransaction(billingid);
//           const servicesClass = new Services(null);
//           servicesClass.deleteServicesAssociatedToBillingId(billingid);
//           await this.deleteBillingHistory(billingid);
//           const testAscensionClass = new TestAscension(null);
//           await testAscensionClass.deleteBilledAssociatedAscension(billingid);
//      }

//      private async loadMultipleServices(billingData: TBillingData,
//           employeeid: number,
//           samplingCenter: number,
//           billingid: any,
//           taxValue: number,
//           includeTax: number,
//           taxList: number,
//           insertionErrors: any[]) {
//           for (const item of billingData.servicesProvided) {
//                try {
//                     const { keyid, servicePrice, discount = 0 } = item;

//                     const data = {
//                          trackid: keyid,
//                          employeeid,
//                          cost: servicePrice,
//                          serviceCategory: 'SERVICES',
//                          categoryTrackId: 5,
//                          branchid: samplingCenter,
//                          billingid,
//                          taxList,
//                          taxValue
//                     };

//                     await this.loadServiceBillingAsService({ ...data, taxValue, includeTax, taxList, discount });
//                } catch (err) {
//                     insertionErrors.push(item);
//                     throw err;
//                }
//           }
//           return insertionErrors;
//      }


// }

