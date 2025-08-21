import { PrimeLimsTableexpensesrecord, PrimeLimsTablesalessessionmanager } from "../../../database/DatabaseTableSchema";
import KnexConnection from "../../../database/KnexConnections";
import Expenses from "../../Expenses/ExpenseService";
import { OperationsFailures } from "../../operations/types";
import { SalesSessionRepo } from "./SalesSessionRepo";

export default class SalesSessionServices {
     public static async getSessionFinancialSummary(tenantId: number, sessionId: number) {
          const session: PrimeLimsTablesalessessionmanager | null = await new SalesSessionRepo(tenantId).findById(sessionId);
          if (!session) return OperationsFailures.billingSessionNotFound;
          const isSessionEnded = session.sessionendedon !== null;
          if (isSessionEnded) return OperationsFailures.billingSessionAlreadyEnded

          const currentDate = new Date();
          const connection = await KnexConnection(tenantId);

          const billingTransactions = await connection.raw(`
                    SELECT * FROM billing
                    WHERE billedon BETWEEN ? AND ?
                    AND status != 'voided'
                    AND status != 'written-off'
                    AND (adjustmentType != 'void' OR adjustmentType IS NULL)
               `, [session.sessiondate, currentDate]);

          const totalPayable = await connection.raw(`
                      SELECT SUM(payable) AS totalpayable,
                      SUM(totalcost) AS totalCost,
                      SUM(paid) AS totalPaid,
                      SUM(outstanding) AS totalOutstanding,
                      SUM(discount) AS totalDiscount,
                      SUM(balance) AS totalbalance
                       FROM billing
                         WHERE billedon BETWEEN ? AND ?
                         AND status != 'voided'
                         AND status != 'written-off'
                    AND (adjustmentType != 'void' OR adjustmentType IS NULL)
                    `, [session.sessiondate, currentDate]);

          let expenseTransactions = await Expenses.getExpensesByCreatedOnRange(
               tenantId,
               session.sessiondate,
               currentDate
          ) as PrimeLimsTableexpensesrecord[];
          
          expenseTransactions = expenseTransactions.filter(e => {
               if (e.approved === null || e.approved === undefined) return false;
               return parseInt(e.approved.toString()) === 1;
          });

          let totalExpense = 0;
          if (expenseTransactions.length > 0) {
               totalExpense = expenseTransactions.reduce(
                    (acc: number, expense: PrimeLimsTableexpensesrecord) => acc + Number(expense.amount),
                    0
               );
          }

          const totalpayable = parseFloat(totalPayable[0][0]['totalpayable']) || 0;
          const totaloutstanding = parseFloat(totalPayable[0][0]['totalOutstanding']) || 0;
          const totalbalance = parseFloat(totalPayable[0][0]['totalbalance']) || 0;
          const expectedAmount = totalpayable - (totalExpense) + parseFloat((session?.openingamount ?? '0').toString());

          return {
               sessionId,
               sessionDate: session.sessiondate,
               sessionStartTime: session.sessiondate,
               sessionEndTime: currentDate,
               totalBillingTransactions: billingTransactions[0],
               totalbalance,
               expenseTransactions,
               totalPayable: totalPayable[0][0].totalpayable || 0,
               totalCost: totalPayable[0][0].totalCost || 0,
               totalPaid: totalPayable[0][0].totalPaid || 0,
               totalOutstanding: totalPayable[0][0].totalOutstanding || 0,
               totalDiscount: totalPayable[0][0].totalDiscount || 0,
               totalExpense,
               expectedAmount,
          }
     }
}