import KnexConnection from '../../database/KnexConnections';
import { AccountingError } from '../errors/AccountingErrors';
import { IFinancialFinalizationGuard } from '../interfaces/IFinancialFinalizationGuard';

export class FinancialFinalizationGuard implements IFinancialFinalizationGuard {
     constructor(private readonly tenantId: number, private readonly connectionOverride?: any) { }

     async assertDateOpen(branchId: number, date: Date | string): Promise<void> {
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          const financialDate = this.dateOnly(date);
          const finalized = await db('financial_day_closures').where({ branchid: branchId, financial_date: financialDate, status: 'finalized' }).first();
          if (finalized) throw new AccountingError(`Financial day ${financialDate} is finalized and immutable`, 'FINANCIAL_RECORD_FINALIZED', 409);
     }

     async assertRecordMutable(sourceTable: string, sourceRef: string | number): Promise<void> {
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          const locked = await db('financial_record_locks').where({ source_table: sourceTable, source_ref: String(sourceRef) }).first();
          if (locked) throw new AccountingError('Financial record is finalized and immutable; use a linked reversal correction', 'FINANCIAL_RECORD_FINALIZED', 409);
     }

     private dateOnly(value: Date | string): string {
          const date = value instanceof Date ? value : new Date(value);
          if (!Number.isFinite(date.getTime())) throw new AccountingError('A valid financial date is required', 'INVALID_FINANCIAL_DATE', 400);
          return date.toISOString().slice(0, 10);
     }
}
