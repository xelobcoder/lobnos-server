import type { Knex } from 'knex';

export function financialActivity(db: Knex, branchId: number) {
     return db.queryBuilder().unionAll([
          db('billing').where({ branchid: branchId }).select(db.raw('DATE(billedon) AS financial_date')),
          db('dboservices').where({ branchid: branchId }).select(db.raw('DATE(serviceAddedOn) AS financial_date')),
          db('billinghx as receipt').join('billing as bill', 'bill.billingid', 'receipt.Billingid').where('bill.branchid', branchId).select(db.raw('DATE(receipt.Date) AS financial_date')),
          db('dbobillingrefundtable as refund').join('dboservices as service', 'service.serviceid', 'refund.serviceid').where('service.branchid', branchId).where('refund.isRefundCompleted', 1).select(db.raw('DATE(refund.approvalDate) AS financial_date')),
          db('expensesrecord').where({ branchid: branchId }).select(db.raw('DATE(date) AS financial_date')),
          db('expense_payments').where({ branchid: branchId }).select(db.raw('DATE(payment_date) AS financial_date')),
          db('finance_ledger').where({ branchid: branchId }).select(db.raw('DATE(occurred_at) AS financial_date')),
          db('acc_journal_entries as entry').join('acc_journal_lines as line', 'line.journal_entry_id', 'entry.id').where('line.branchid', branchId).select(db.raw('DATE(entry.occurred_at) AS financial_date')),
          db('financial_day_closures').where({ branchid: branchId }).select('financial_date'),
     ]).as('activity');
}

export function excludeHistoricalLocks(query: Knex.QueryBuilder, db: Knex, branchId: number) {
     return query.whereNotExists(db('financial_historical_locks as historical')
          .select(db.raw('1')).where('historical.branchid', branchId)
          .whereRaw('activity.financial_date BETWEEN historical.start_date AND historical.end_date'));
}
