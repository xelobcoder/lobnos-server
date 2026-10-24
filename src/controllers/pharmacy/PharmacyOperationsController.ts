import { Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { actorOf, branchOf, tenantOf } from './pharmacyContext';
import { money } from '../../models/pharmacy/PharmacyRules';
import { assertPharmacyDayOpen } from '../../models/pharmacy/PharmacyLedger';
import { collectPharmacyPayment } from '../../models/pharmacy/PharmacyPayments';
import { PharmacySaleRepository } from '../../models/pharmacy/repositories/PharmacySaleRepository';

const dateOf = (input: unknown) => {
     const value=String(input || new Date().toISOString().slice(0,10));
     if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('Use a valid date in YYYY-MM-DD format');
     return value;
};
export async function pharmacyCashierTotals(db: any, branch: number, cashier: number, date: string, account?: number) {
     const query=db('pharmacy_payments').where({branchid:branch}).whereIn('sale_id',db('pharmacy_sales').select('id').where('accounting_version',2));
     if(account)query.where('payment_account_id',account);
     const events=db('pharmacy_cash_events').where({branchid:branch,actor_id:cashier});if(account)events.where('account_id',account);
     const [legacyCollections,legacyRefunds,eventCollections,eventRefunds]=await Promise.all([
          query.clone().where('recorded_by',cashier).whereRaw('DATE(collected_at) = ?',[date]).select('method','payment_account_id').sum('amount as amount').count('* as count').groupBy('method','payment_account_id'),
          query.clone().where({reversed_by:cashier,status:'refunded'}).whereRaw('DATE(reversed_at) = ?',[date]).select('method','payment_account_id').sum('amount as amount').groupBy('method','payment_account_id'),
          events.clone().where('event_type','collection').whereRaw('DATE(occurred_at) = ?',[date]).select('method','account_id as payment_account_id').sum('amount as amount').count('* as count').groupBy('method','account_id'),
          events.clone().where('event_type','refund').whereRaw('DATE(occurred_at) = ?',[date]).select('method','account_id as payment_account_id').sum('amount as amount').groupBy('method','account_id'),
     ]);
     const collections=[...legacyCollections,...eventCollections],refunds=[...legacyRefunds,...eventRefunds];
     const methods=['cash','mobile_money','card'];
     const paymentTotals=Object.fromEntries(methods.map(method=>[method,money(collections.filter((row:any)=>row.method===method).reduce((sum:number,row:any)=>sum+Number(row.amount),0)-refunds.filter((row:any)=>row.method===method).reduce((sum:number,row:any)=>sum+Number(row.amount),0))]));
     return {paymentTotals,todaySales:money(Object.values(paymentTotals).reduce((sum,value)=>sum+value,0)),completedSales:collections.reduce((sum:number,row:any)=>sum+Number(row.count),0),collections,refunds};
}
export class PharmacyOperationsController {
     static async reconcileHistoricalCollection(req:Request,res:Response) {
          res.status(409).json({success:false,error:{message:'Legacy collections require reconciliation in the original books. New pharmacy books cannot collect historical sales.'}});
     }
     static async collectionAccounts(req: Request,res: Response) {
          try {
               const db=await KnexConnection(tenantOf(req));
               const query=db('pharmacy_collection_accounts').where({branchid:branchOf(req),is_active:true}).select('id','name','account_type','currency').select(db.raw('1 as can_reconcile'));
               res.json({success:true,data:await query.orderBy('name')});
          }catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}
     }
     static async cashier(req: Request,res: Response) {
          try {
               const branch=branchOf(req); if(!branch)throw new Error('Select an operating branch');
               const db=await KnexConnection(tenantOf(req)),date=dateOf(req.query.date);
               const totals=await pharmacyCashierTotals(db,branch,actorOf(req),date);
               const [sales,reconciliations]=await Promise.all([
                    db('pharmacy_sales').where({branchid:branch,cashier_id:actorOf(req)}).whereIn('accounting_version',[2,3]).whereRaw('DATE(completed_at) = ?',[date]).orderBy('completed_at','desc').limit(100),
                    db('pharmacy_reconciliations').where({branchid:branch,cashier_id:actorOf(req),financial_date:date}).orderBy('recorded_at','desc').limit(20),
               ]);
               res.json({success:true,data:{...totals,date,sales:sales.map(row=>({id:row.id,receiptNumber:row.receipt_number,customerName:row.customer_name,paymentMethod:row.payment_method,total:Number(row.total_amount),status:row.status,completedAt:row.completed_at})),reconciliations}});
          }catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}
     }
     static async reconcile(req: Request,res: Response) {
          try {
               const db=await KnexConnection(tenantOf(req)),branch=branchOf(req),date=dateOf(req.body.date),accountId=Number(req.body.paymentAccountId),counted=req.body.countedAmount;
               if(!branch||!Number.isInteger(accountId)||!Number.isFinite(counted)||counted<0||money(counted)!==counted)throw new Error('Select an account and enter the counted amount with at most two decimal places');
               const notes=String(req.body.notes||'').trim(); if(notes.length<3||notes.length>500)throw new Error('Enter a reconciliation note of 3 to 500 characters');
               const data=await db.transaction(async trx=>{
                    const account=await trx('pharmacy_collection_accounts').where({id:accountId,is_active:true,branchid:branch}).forUpdate().first();
                    if(!account)throw new Error('Reconciliation access to this account is required');
                    await assertPharmacyDayOpen(trx,branch,date);
                    const totals=await pharmacyCashierTotals(trx,branch,actorOf(req),date,accountId);
                    const row={payment_account_id:accountId,cashier_id:actorOf(req),branchid:branch,financial_date:date,expected_amount:totals.todaySales,counted_amount:counted,difference:money(counted-totals.todaySales),notes,recorded_by:actorOf(req),recorded_at:new Date()};
                    await trx('pharmacy_reconciliations').insert(row); return row;
               });
               res.status(201).json({success:true,data});
          }catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}
     }
     static async updateItemProfile(req: Request,res: Response) {
          try {
               const {requiresPrescription,batchTracking}=req.body;
               if(typeof requiresPrescription!=='boolean'||typeof batchTracking!=='boolean')throw new Error('Prescription and batch tracking choices must be provided');
               const db=await KnexConnection(tenantOf(req));
               await db.transaction(async trx=>{
                    const item=await trx('pharmacy_inventory_items').where({id:String(req.params.itemId),branchid:branchOf(req)}).forUpdate().first();
                    if(!item)throw new Error('Pharmacy item not found');
                    const values={requires_prescription:requiresPrescription,pharmacy_batch_tracking:batchTracking};
                    await trx('pharmacy_inventory_items').where({id:item.id}).update({...values,updated_at:new Date()});
                    await trx('pharmacy_item_profile_audit').insert({item_id:item.id,previous_values:JSON.stringify({requires_prescription:item.requires_prescription,pharmacy_batch_tracking:item.pharmacy_batch_tracking}),new_values:JSON.stringify(values),changed_by:actorOf(req),changed_at:new Date()});
               });
               res.json({success:true});
          }catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}
     }
}
