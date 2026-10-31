import Decimal from 'decimal.js';
export class PaymentFundingError extends Error {constructor(message:string,readonly statusCode=409){super(message);}}

/** Posted funds less committed outgoing postings. Unposted income is not spendable. */
export async function fundingAvailability(db:any, glCode:string, lock=false) {
     let query=db('acc_accounts').where({account_code:glCode,is_active:true,type:'asset'});
     if(lock) query=query.forUpdate();
     const account=await query.first();
     if(!account) throw new PaymentFundingError('Funding ledger account is unavailable');
     const lines=await db('acc_journal_lines as line').join('acc_journal_entries as entry','entry.id','line.journal_entry_id')
          .where('line.account_id',account.id).whereNotIn('entry.status',['voided']).select('line.direction','line.amount');
     let posted=new Decimal(0),committed=new Decimal(0);
     for(const line of lines) posted=posted.plus(new Decimal(line.amount).times(line.direction==='debit'?1:-1));
     const pending=await db('acc_posting_outbox').whereNotIn('status',['posted']).select('*');
     for(const row of pending){
          const payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
          const credits=(payload.lines||[]).filter((line:any)=>line.accountCode===glCode&&line.direction==='credit');
          if(!credits.length)continue;
          // The worker can commit a journal before marking its outbox row posted.
          const recorded=await db('acc_journal_entries').where({source_module:row.source_module,source_table:row.source_table,
               source_pk:row.source_pk,source_ref:row.source_ref||'',transaction_type:row.transaction_type}).first();
          if(recorded)continue;
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
