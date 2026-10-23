import { quantity } from './PharmacyRules';
export async function pharmacyAvailability(db: any, items: Array<{id:string;currentStock:number;batchTracking:boolean}>): Promise<Map<string,number>> {
     const result=new Map<string,number>(); if(!items.length)return result;
     const batches=await db('inv_inventory_transactions').select('item_id','batch_number').min('expiry_date as expiry_date')
          .select(db.raw('SUM(new_stock - previous_stock) as available')).whereIn('item_id',items.map(item=>item.id)).whereNotNull('batch_number').groupBy('item_id','batch_number');
     const today=new Date().toISOString().slice(0,10);
     for(const item of items) {
          const rows=batches.filter((row:any)=>row.item_id===item.id);
          const tracked=rows.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.available)),0);
          const usable=rows.filter((row:any)=>row.expiry_date?new Date(row.expiry_date).toISOString().slice(0,10)>=today:!item.batchTracking).reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.available)),0);
          result.set(item.id,quantity(Math.max(0,Math.min(item.currentStock,usable+(item.batchTracking?0:Math.max(0,item.currentStock-tracked))))));
     }
     return result;
}
