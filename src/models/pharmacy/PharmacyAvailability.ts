import { quantity } from './PharmacyRules';
export async function pharmacyAvailability(db: any, items: Array<{id:string;currentStock:number;batchTracking:boolean}>): Promise<Map<string,number>> {
     const result=new Map<string,number>(); if(!items.length)return result;
     const ids=[...new Set(items.map(item=>item.id))],byItem=new Map<string,any[]>();
     for(let offset=0;offset<ids.length;offset+=5000){
          const batches=await db('pharmacy_stock_movements').select('item_id','batch_number').min('expiry_date as expiry_date')
               .select(db.raw('SUM(new_stock - previous_stock) as available')).whereIn('item_id',ids.slice(offset,offset+5000)).whereNotNull('batch_number').groupBy('item_id','batch_number');
          for(const batch of batches){const rows=byItem.get(batch.item_id)||[];rows.push(batch);byItem.set(batch.item_id,rows);}
     }
     const today=new Date().toISOString().slice(0,10);
     const recalls=await db('pharmacy_batch_recalls').whereIn('item_id',ids).where('status','active');
     for(const item of items) {
          const rows=byItem.get(item.id)||[];
          const tracked=rows.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.available)),0);
          const usable=rows.filter((row:any)=>!recalls.some((recall:any)=>recall.item_id===item.id&&recall.batch_number===row.batch_number)&&(row.expiry_date?new Date(row.expiry_date).toISOString().slice(0,10)>=today:!item.batchTracking)).reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.available)),0);
          result.set(item.id,quantity(Math.max(0,Math.min(item.currentStock,usable+(item.batchTracking?0:Math.max(0,item.currentStock-tracked))))));
     }
     return result;
}
