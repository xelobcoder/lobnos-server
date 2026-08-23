import KnexConnection from '../../database/KnexConnections';
import { enqueuePosting } from '../services/AccountingOutboxService';
import { IPayrollAccounting } from '../interfaces/IAccountingIntegrations';
import { NormalBalance } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import logger from '../../hooks/logger';

const CASH = 'acc-1000';
const BANK = 'acc-1001';
const PAYE_PAYABLE = 'acc-2004';
const SALARIES_PAYABLE = 'acc-2006';
const OTHER_DEDUCTIONS_PAYABLE = 'acc-2008';
const SALARIES_EXPENSE = 'acc-5002';

const CASH_METHODS = new Set(['cash']);

async function resolveDb(tenantId: number, trx?: any): Promise<any> {
     return trx || (await KnexConnection(tenantId));
}

async function periodTotals(db: any, periodId: number) {
     const row = await db('payroll_transactions')
          .where({ payroll_period_id: periodId })
          .whereNot('status', 'cancelled')
          .select(
               db.raw('COALESCE(SUM(gross_salary), 0) AS gross'),
               db.raw('COALESCE(SUM(income_tax), 0) AS paye'),
               db.raw('COALESCE(SUM(total_other_deductions), 0) AS other_deductions'),
               db.raw('COALESCE(SUM(net_salary), 0) AS net')
          )
          .first();

     return {
          gross: round2(Number(row?.gross || 0)),
          paye: round2(Number(row?.paye || 0)),
          otherDeductions: round2(Number(row?.other_deductions || 0)),
          net: round2(Number(row?.net || 0)),
     };
}

export async function enqueuePayrollAccrual(
     tenantId: number,
     periodId: number,
     employeeId?: number | null,
     trx?: any
): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const totals = await periodTotals(db, periodId);
          if (totals.gross <= 0) return;

          const period = await db('payroll_periods').where({ id: periodId }).first();

          const lines = [
               { accountCode: SALARIES_EXPENSE, direction: NormalBalance.DEBIT, amount: totals.gross },
               ...(totals.paye > 0
                    ? [{ accountCode: PAYE_PAYABLE, direction: NormalBalance.CREDIT, amount: totals.paye }]
                    : []),
               ...(totals.otherDeductions > 0
                    ? [{ accountCode: OTHER_DEDUCTIONS_PAYABLE, direction: NormalBalance.CREDIT, amount: totals.otherDeductions }]
                    : []),
               ...(totals.net > 0
                    ? [{ accountCode: SALARIES_PAYABLE, direction: NormalBalance.CREDIT, amount: totals.net }]
                    : []),
          ];

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.ACCRUAL,
                    sourceModule: SourceModule.PAYROLL,
                    sourceTable: 'payroll_periods',
                    sourcePk: Number(periodId),
                    description: `Payroll approved${period?.period_name ? ` - ${period.period_name}` : ''}`,
                    occurredAt: period?.period_end_date || new Date(),
                    createdBy: employeeId ?? null,
                    lines,
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue payroll accrual posting', {
               tenantId,
               periodId,
               error: error?.message || String(error),
          });
     }
}

export async function enqueuePayrollPayment(
     tenantId: number,
     periodId: number,
     paymentMethod: string,
     paymentDate: string | Date,
     employeeId?: number | null,
     trx?: any
): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const totals = await periodTotals(db, periodId);
          if (totals.net <= 0) return;

          const cashAccount = CASH_METHODS.has(String(paymentMethod).toLowerCase()) ? CASH : BANK;

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.PAYMENT,
                    sourceModule: SourceModule.PAYROLL,
                    sourceTable: 'payroll_periods',
                    sourcePk: Number(periodId),
                    sourceRef: 'net-pay',
                    description: 'Payroll net pay disbursed',
                    occurredAt: paymentDate || new Date(),
                    createdBy: employeeId ?? null,
                    lines: [
                         { accountCode: SALARIES_PAYABLE, direction: NormalBalance.DEBIT, amount: totals.net },
                         { accountCode: cashAccount, direction: NormalBalance.CREDIT, amount: totals.net },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue payroll payment posting', {
               tenantId,
               periodId,
               error: error?.message || String(error),
          });
     }
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}

export const payrollAccounting: IPayrollAccounting = {
     enqueuePayrollAccrual,
     enqueuePayrollPayment,
};
