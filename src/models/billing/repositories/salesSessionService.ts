import { PrimeLimsTablebilling, PrimeLimsTableexpensesrecord, PrimeLimsTablesalessessionmanager } from "../../../database/DatabaseTableSchema";
import KnexConnection from "../../../database/KnexConnections";
import ExpenseInvoiceRepo from "../../Expenses/ExpenseInvoiceRepo";
import Expenses from "../../Expenses/ExpenseService";
import { OperationsFailures } from "../../operations/types";
import { SalesSessionRepo } from "./SalesSessionRepo";


interface TotalPayableResult {
     accrued_revenue: number;
     totalCost: number;
     actual_revenue: number;
     outstanding_amount: number;
     total_discount: number;
     total_balance: number;
     total_refunded: number;
     total_billing_transactions: number;
}

export default class SalesSessionServices {
     public static async getSessionFinancialSummary(tenantId: number, employeeid: number, branchid: number, sessionId: number) {
          const session: PrimeLimsTablesalessessionmanager | null = await new SalesSessionRepo(tenantId).findById(sessionId);
          if (!session) return OperationsFailures.billingSessionNotFound;

          const currentDate = new Date();
          const connection = await KnexConnection(tenantId);

          // Determine end date
          let endDate: Date;
          if (session.sessionendedon) {
               endDate = new Date(session.sessionendedon);
          } else {
               // Find next session
               const nextSession = await connection('salessessionmanager')
                    .where('sessiondate', '>', session.sessiondate)
                    .orderBy('sessiondate', 'asc')
                    .first();
               endDate = nextSession ? new Date(nextSession.sessiondate) : currentDate;
          }

          const billingTransactions: TotalPayableResult = await connection('billing')
               .where('branchid', branchid)
               .whereBetween('billedon', [session.sessiondate, endDate])
               .select(
                    connection.sum('payable').as('accrued_revenue'),
                    connection.sum('totalcost').as('totalCost'),
                    connection.sum('paid').as('actual_revenue'),
                    connection.sum('outstanding').as('outstanding_amount'),
                    connection.sum('discount').as('total_discount'),
                    connection.sum('balance').as('total_balance'),
                    connection.sum('totalrefunded').as('total_refunded'),
                    connection.count('billingid').as('total_billing_transactions')
               )
               .first() as TotalPayableResult;


          const billingRecords: PrimeLimsTablebilling[] = await connection('billing')
               .where('branchid', branchid)
               .whereBetween('billedon', [session.sessiondate, endDate]);


          let expenseTransactions = await Expenses.getExpensesByCreatedOnRange(
               tenantId,
               session.sessiondate,
               endDate
          ) as PrimeLimsTableexpensesrecord[];


          const expensePaymentsMadeRecords = await new ExpenseInvoiceRepo(employeeid, branchid, tenantId).getPaymentsBetweenDates(
               tenantId,
               session.sessiondate as string,
               endDate as any
          );




          const expensePaymentsMade: number = await new ExpenseInvoiceRepo(employeeid, branchid, tenantId).getSumOfPayments(
               tenantId,
               session.sessiondate as string,
               endDate as any
          );

          const netRevenue = billingTransactions.actual_revenue - expensePaymentsMade
          const expectedAmount = netRevenue > 0 ? parseFloat(netRevenue.toString()) + parseFloat(session.openingamount.toString()) : session.openingamount


          return {
               sessionId,
               sessionDate: session.sessiondate,
               sessionStartTime: session.sessiondate,
               sessionEndTime: endDate,
               totalBillingTransactions: billingTransactions.total_billing_transactions,
               totalExpensesTransactions: expenseTransactions.length,
               totalExpensePaymentsMade: expensePaymentsMade,
               billingTransactions: billingRecords,
               netRevenue,
               expectedAmount,
               openingAmount: session.openingamount,
               accruedRevenue: billingTransactions.accrued_revenue,
               expenseRecordsDuringSession: expenseTransactions,
               expensePaymentsMadeRecords,
          }
     }
}