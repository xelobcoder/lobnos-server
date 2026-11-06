import Decimal from 'decimal.js';
export class PaymentFundingError extends Error {constructor(message:string,readonly statusCode=409){super(message);}}

/** Posted funds less committed outgoing postings. Unposted income is not spendable. */
export async function fundingAvailability(db:any, glCode:string, lock=false) {
     let query=db('acc_accounts').where({account_code:glCode,is_active:true,type:'asset'});
     if(lock) query=query.forUpdate();
     const account=await query.first();
     if(!account) throw new PaymentFundingError('Funding ledger account is unavailable');
     // Aggregate in SQL instead of transferring the entire funding ledger into memory.
     const total=await db('acc_journal_lines as line').join('acc_journal_entries as entry','entry.id','line.journal_entry_id')
          .where('line.account_id',account.id).whereNotIn('entry.status',['voided'])
          .select(db.raw("COALESCE(SUM(CASE WHEN line.direction = 'debit' THEN line.amount ELSE -line.amount END), 0) AS balance")).first();
     const posted=new Decimal(total.balance),committedRows=await db('acc_posting_outbox as pending')
          .whereNotIn('pending.status',['posted'])
          // The worker can commit its journal before acknowledging the outbox. Exclude
          // those rows in one indexed existence query, not one lookup per payment.
          .whereNotExists(function(this:any){
               this.select(db.raw('1')).from('acc_journal_entries as recorded')
                    .whereColumn('recorded.source_module','pending.source_module')
                    .whereColumn('recorded.source_table','pending.source_table')
                    .whereColumn('recorded.source_pk','pending.source_pk')
                    .whereRaw("recorded.source_ref = COALESCE(pending.source_ref, '')")
                    .whereColumn('recorded.transaction_type','pending.transaction_type');
          }).select('pending.payload');
     let committed=new Decimal(0);
     for(const row of committedRows){
          const payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
          const credits=(payload.lines||[]).filter((line:any)=>line.accountCode===glCode&&line.direction==='credit');
          if(!credits.length)continue;
          for(const line of credits)committed=committed.plus(line.amount);
     }
     return {posted_balance:posted.toDecimalPlaces(2).toNumber(),committed_amount:committed.toDecimalPlaces(2).toNumber(),
          available_balance:posted.minus(committed).toDecimalPlaces(2).toNumber()};
}

export async function assertFundingAvailable(db:any,glCode:string,amount:number){
     if(!Number.isFinite(amount)||amount<=0)throw new PaymentFundingError('Payment amount must be positive',400);
     const balance=await fundingAvailability(db,glCode,true);
     if(new Decimal(amount).greaterThan(balance.available_balance))throw new PaymentFundingError(`Insufficient funds: available GHS ${balance.available_balance.toFixed(2)}; required GHS ${amount.toFixed(2)}. Fund the source account before retrying.`);
     return balance;
}
