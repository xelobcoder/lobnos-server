import { Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { actorOf, branchOf, tenantOf } from './pharmacyContext';
import { money } from '../../models/pharmacy/PharmacyRules';
import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';
import { collectPharmacyPayment } from '../../models/pharmacy/PharmacyPayments';
import { PharmacySaleRepository } from '../../models/pharmacy/repositories/PharmacySaleRepository';

const dateOf = (input: unknown) => {
     const value=String(input || new Date().toISOString().slice(0,10));
     if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('Use a valid date in YYYY-MM-DD format');
     return value;
};
export async function pharmacyCashierTotals(db: any, branch: number, cashier: number, date: string, account?: number) {
     const query=db('pharmacy_payments').where({branchid:branch});
     if(account)query.where('payment_account_id',account);
     const [collections,refunds]=await Promise.all([
          query.clone().where('recorded_by',cashier).whereRaw('DATE(collected_at) = ?',[date]).select('method','payment_account_id').sum('amount as amount').count('* as count').groupBy('method','payment_account_id'),
          query.clone().where({reversed_by:cashier,status:'refunded'}).whereRaw('DATE(reversed_at) = ?',[date]).select('method','payment_account_id').sum('amount as amount').groupBy('method','payment_account_id'),
     ]);
     const methods=['cash','mobile_money','card'];
     const paymentTotals=Object.fromEntries(methods.map(method=>[method,money(collections.filter((row:any)=>row.method===method).reduce((sum:number,row:any)=>sum+Number(row.amount),0)-refunds.filter((row:any)=>row.method===method).reduce((sum:number,row:any)=>sum+Number(row.amount),0))]));
     return {paymentTotals,todaySales:money(Object.values(paymentTotals).reduce((sum,value)=>sum+value,0)),completedSales:collections.reduce((sum:number,row:any)=>sum+Number(row.count),0),collections,refunds};
}
export class PharmacyOperationsController {
     static async reconcileHistoricalCollection(req:Request,res:Response) {
          try {
               const branch=branchOf(req),accountId=Number(req.body.paymentAccountId);
               if(!branch||!Number.isInteger(accountId)||req.body.confirmedHistoricalCollection!==true)throw new Error('Confirm the historical collection, operating branch and collection account');
               const db=await KnexConnection(tenantOf(req));
               await db.transaction(async trx=>{
                    const row=await trx('pharmacy_sales').where({id:String(req.params.saleId)}).forUpdate().first();
                    if(!row||row.status!=='completed'||(row.branchid!=null&&Number(row.branchid)!==branch))throw new Error('Completed sale not found in this branch');
                    if(await trx('pharmacy_payments').where({sale_id:row.id}).first())throw new Error('This sale already has a collection record');
                    const reference=String(req.body.paymentReference||row.payment_reference||'').trim();
                    if(reference.length>128||(!reference&&row.payment_method!=='cash'))throw new Error('A valid historical payment reference is required');
                    await new FinancialFinalizationGuard(tenantOf(req),trx).assertRecordMutable('pharmacy_sales',row.id);
                    // Read mapping from the repository, but keep all mutations on the locked transaction.
                    const sale=await new PharmacySaleRepository(tenantOf(req)).findSaleById(row.id,trx);
                    if(!sale)throw new Error('Sale not found');
                    await collectPharmacyPayment(trx,tenantOf(req),{...sale,paymentAccountId:accountId,branchid:branch,paymentReference:reference||null},actorOf(req));
                    await trx('pharmacy_sales').where({id:row.id}).update({payment_account_id:accountId,branchid:branch,payment_reference:reference||null,updated_at:new Date()});
               });
               res.json({success:true});
          }catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}
     }
     static async collectionAccounts(req: Request,res: Response) {
          try {
               const db=await KnexConnection(tenantOf(req));
               const query=db('payment_accounts as a').join('payment_account_users as u','u.payment_account_id','a.id')
                    .where({'a.is_active':true,'u.is_active':true,'u.employeeid':actorOf(req),'u.can_pay':true,'a.currency':'GHS'})
                    .whereIn('a.account_type',['cash','bank','mobile_money']).select('a.id','a.name','a.account_type','a.currency','u.can_reconcile');
               query.where(builder=>builder.whereNull('a.branchid').orWhere('a.branchid',branchOf(req)));
               res.json({success:true,data:await query.orderBy('a.name')});
          }catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}
     }
     static async cashier(req: Request,res: Response) {
          try {
               const branch=branchOf(req); if(!branch)throw new Error('Select an operating branch');
               const db=await KnexConnection(tenantOf(req)),date=dateOf(req.query.date);
               const totals=await pharmacyCashierTotals(db,branch,actorOf(req),date);
               const [sales,reconciliations]=await Promise.all([
                    db('pharmacy_sales').where({branchid:branch,cashier_id:actorOf(req)}).whereRaw('DATE(completed_at) = ?',[date]).orderBy('completed_at','desc').limit(100),
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
                    const account=await trx('payment_accounts').where({id:accountId,is_active:true}).forUpdate().first();
                    const access=await trx('payment_account_users').where({payment_account_id:accountId,employeeid:actorOf(req),can_reconcile:true,is_active:true}).first();
                    if(!account||!access||(account.branchid!=null&&Number(account.branchid)!==branch))throw new Error('Reconciliation access to this account is required');
                    await new FinancialFinalizationGuard(tenantOf(req),trx).assertDateOpen(branch,date);
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
                    const item=await trx('inv_inventory_items').where({id:String(req.params.itemId),inventory_domain:'pharmacy'}).forUpdate().first();
                    if(!item)throw new Error('Pharmacy item not found');
                    const values={requires_prescription:requiresPrescription,pharmacy_batch_tracking:batchTracking};
                    await trx('inv_inventory_items').where({id:item.id}).update({...values,updated_at:new Date()});
                    await trx('pharmacy_item_profile_audit').insert({item_id:item.id,previous_values:JSON.stringify({requires_prescription:item.requires_prescription,pharmacy_batch_tracking:item.pharmacy_batch_tracking}),new_values:JSON.stringify(values),changed_by:actorOf(req),changed_at:new Date()});
               });
               res.json({success:true});
          }catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}
     }
}
