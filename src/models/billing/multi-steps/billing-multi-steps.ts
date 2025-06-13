// import { PrimeLimsTabledboservices } from "../../../database/DatabaseTableSchema";
// import KnexConnection from "../../../database/KnexConnections";

// class BillingMultiSteps {
//     private tenantId: number;
//     private connection: any;
//     private tablename: string;
//     private branchid: number;
//     private patientid: number;

//     constructor(tenantId: number, branchid: number, patientid: number) {
//         this.tenantId = tenantId;
//         this.tablename = "test_billing";
//         this.branchid = branchid;
//         this.connection = KnexConnection(tenantId);
//         this.patientid = patientid;
//     }

//     async securedBillingId(clientstatus: string, trx: any): Promise<string> {
//         const result = await trx(this.tablename).insert({
//             branchid: this.branchid,
//             clientstatus: clientstatus,
//             patientid: this.patientid
//         }).returning('id');

//         return result[0];
//     }

//     async insertServices(billingId: string, trx: any): Promise<boolean> {
//         try {
//             const services: PrimeLimsTabledboservices[] = [
//                 {
//                     cost: 1000,
//                     employeeid: 3,
//                     serviceCategory: "GENERAL",
//                     categoryTrackId: 3,
//                     clinicianId: 2,
//                     organizationId: 3,
//                     registrationType: 'self',
//                     branchid: this.branchid,
//                     isoutsourced: 0,
//                     outsourceid: null,
//                     taxList: null,
//                     taxValue: 0,
//                     amountIncurredDueTax: 300,
//                     taxIncluded: 0,
//                     discount: 0,
//                     totalcost: 1000,
//                     totalpayable: 700,
//                     isNHIS: 0,
//                     billingid: billingId,
//                     isPHIS: 0,
//                     insuranceid: null,
//                     hasNightAdjustment: 0,
//                     claimCode: null,
//                     nightAdjustmentValue: 0,
//                     nightAdjustmentMode: 'absolute',
//                     isPackageUsed: 0,
//                     packageid: null
//                 },
//                 {
//                     cost: 2000,
//                     employeeid: 4,
//                     serviceCategory: "GENERAL",
//                     categoryTrackId: 4,
//                     clinicianId: 2,
//                     organizationId: 3,
//                     registrationType: 'self',
//                     branchid: this.branchid,
//                     isoutsourced: 0,
//                     outsourceid: null,
//                     taxList: null,
//                     taxValue: 3.654,
//                     amountIncurredDueTax: 200,
//                     taxIncluded: 0,
//                     discount: 0,
//                     totalcost: 2000,
//                     totalpayable: 1800,
//                     isNHIS: 0,
//                     billingid: billingId,
//                     isPHIS: 0,
//                     insuranceid: null,
//                     hasNightAdjustment: 0,
//                     claimCode: null,
//                     nightAdjustmentValue: 0,
//                     nightAdjustmentMode: 'absolute',
//                     isPackageUsed: 0,
//                     packageid: null
//                 }
//             ];

//             for (const service of services) {
//                 await trx("test_dboservices").insert(service);
//             }
//             return true;
//         } catch (error) {
//             console.error("Error inserting services:", error);
//             throw new Error("Failed to insert services");
//         }
//     }

//     async processTransaction(): Promise<string> {
//         const connection = await this.connection;
//         try {
//             const trx = await connection.transaction();
//             try {
//                 const billingId = await this.securedBillingId('normal', trx);
//                 await this.insertServices(billingId, trx);
//                 await this.addPaymentHistory(billingId, 1, 2500, 'credit', trx);
//                 await trx.commit();
//                 return billingId;
//             } catch (error) {
//                 console.error("Transaction failed:", error);
//                 await trx.rollback();
//                 throw error;
//             }
//         } catch (error) {
//             console.error("Failed to start transaction:", error);
//             throw error;
//         }
//     }

//     async addPaymentHistory(billingId: string, paymentmode: number, amount: number, type: 'debit' | "credit", trx: any): Promise<boolean> {
//         try {
//             const paymentHistory = {
//                 billingid: parseInt(billingId, 10),
//                 Date: new Date(),
//                 PaymentMode: paymentmode,
//                 type: type,
//                 Amount: amount,
//                 employeeid: 3,
//                 description: "Payment for services rendered",
//                 isRefund: 0,
//                 refundid: null,
//             };

//             await trx("test_billinghx").insert(paymentHistory);
//             return true;
//         } catch (error) {
//             console.error("Error adding payment history:", error);
//             throw new Error("Failed to add payment history");
//         }
//     }
// }

// export default BillingMultiSteps;