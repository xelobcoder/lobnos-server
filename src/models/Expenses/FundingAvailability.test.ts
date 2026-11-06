import {describe,it,expect} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {fundingAvailability,assertFundingAvailable} from './FundingAvailability';
describe('funding ledger availability',()=>{
 it('deducts committed credits, does not spend pending income, and does not double-count posted outbox entries',async()=>{
  const {db}=accountingSqlDatabase();try{
   await db.schema.createTable('acc_accounts',t=>{t.integer('id');t.string('account_code');t.string('type');t.boolean('is_active');});
   await db.schema.createTable('acc_journal_entries',t=>{t.integer('id');t.string('status');t.string('source_module');t.string('source_table');t.integer('source_pk');t.string('source_ref');t.string('transaction_type');});
   await db.schema.createTable('acc_journal_lines',t=>{t.integer('journal_entry_id');t.integer('account_id');t.string('direction');t.decimal('amount');});
   await db.schema.createTable('acc_posting_outbox',t=>{t.string('status');t.string('source_module');t.string('source_table');t.integer('source_pk');t.string('source_ref');t.string('transaction_type');t.text('payload');});
   await db('acc_accounts').insert({id:1,account_code:'cash',type:'asset',is_active:true});
   await db('acc_journal_entries').insert({id:1,status:'posted',source_module:'inventory',source_table:'test',source_pk:1,source_ref:'',transaction_type:'payment'});
   await db('acc_journal_lines').insert({journal_entry_id:1,account_id:1,direction:'debit',amount:1000});
   const row=(pk:number,direction:string,amount:number)=>({status:'failed',source_module:'inventory',source_table:'test',source_pk:pk,source_ref:'',transaction_type:'payment',payload:JSON.stringify({lines:[{accountCode:'cash',direction,amount}]})});
   await db('acc_posting_outbox').insert([row(1,'credit',100),row(2,'credit',250),row(3,'debit',500)]);
   // A backlog of already-journaled payments must not cause one lookup per row.
   await db('acc_posting_outbox').insert(Array.from({length:60},()=>row(1,'credit',100)));
   await db('acc_journal_entries').insert({id:2,status:'voided',source_module:'inventory',source_table:'void',source_pk:2,source_ref:'',transaction_type:'payment'});
   await db('acc_journal_lines').insert({journal_entry_id:2,account_id:1,direction:'credit',amount:999});
   const queries: string[]=[];const record=(query:any)=>queries.push(query.sql);db.on('query',record);
   expect(await fundingAvailability(db,'cash')).toEqual({posted_balance:1000,committed_amount:250,available_balance:750});
   db.off('query',record);expect(queries).toHaveLength(3);
   await expect(assertFundingAvailable(db,'cash',750.01)).rejects.toThrow('Insufficient funds');
   await expect(assertFundingAvailable(db,'cash',750)).resolves.toMatchObject({available_balance:750});
   const results=await Promise.allSettled([9,10].map(pk=>db.transaction(async trx=>{
    await assertFundingAvailable(trx,'cash',500);await trx('acc_posting_outbox').insert(row(pk,'credit',500));
   })));
   expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
   expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
   expect((await fundingAvailability(db,'cash')).available_balance).toBe(250);
  }finally{await db.destroy();}
 });
});
