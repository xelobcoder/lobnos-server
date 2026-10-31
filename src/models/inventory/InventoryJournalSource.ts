import type {Knex} from 'knex';
/** Read-only union: retain historical inventory lines and show current stock/supplier postings. */
export function inventoryJournalSource(db:Knex){
 const legacy=db('acc_journal_entry_lines as old').leftJoin('acc_accounts as account','account.account_code','old.account_id')
  .whereNotExists(db('acc_journal_entries as posted').select(db.raw('1')).whereIn('posted.source_module',['supplier','inventory']).whereRaw('posted.source_pk = old.reference_id AND posted.source_module = old.source_module'))
  .select('old.id','old.account_id','account.name as account_name','old.debit_amount','old.credit_amount','old.line_description','old.reference_id','old.reference_type','old.entry_date','old.source_module','old.entry_status','old.posted_by','old.posted_at','old.created_at','old.updated_at');
 const current=db('acc_journal_lines as line').join('acc_journal_entries as entry','entry.id','line.journal_entry_id').join('acc_accounts as account','account.id','line.account_id')
  .whereIn('entry.source_module',['supplier','inventory']).select(db.raw("CONCAT('posted-',line.id) as id"),'account.account_code as account_id','account.name as account_name',db.raw("CASE WHEN line.direction='debit' THEN line.amount ELSE 0 END as debit_amount"),db.raw("CASE WHEN line.direction='credit' THEN line.amount ELSE 0 END as credit_amount"),'entry.description as line_description','entry.source_pk as reference_id',db.raw("CASE WHEN entry.source_module='supplier' THEN 'supplier_payment' ELSE 'inventory_movement' END as reference_type"),'entry.occurred_at as entry_date','entry.source_module',db.raw("CASE WHEN entry.status='voided' THEN 'cancelled' ELSE entry.status END as entry_status"),'entry.created_by as posted_by','entry.created_at as posted_at','entry.created_at','entry.created_at as updated_at');
 return legacy.unionAll([current]);
}
