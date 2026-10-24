import { describe, expect, it, vi } from 'vitest';
import { PrescriptionService } from './PrescriptionService';

function fixture() {
     let state:any={prescription:{id:'rx',patientId:1,clinicianId:2,status:'pending'},items:[{id:'rx-item',prescriptionId:'rx',inventoryItemId:'drug',drugName:'Drug',quantityOrdered:10,quantityDispensed:0,status:'pending',saleId:null}],sales:[],dispenses:[]};
     let queue=Promise.resolve();let fail=false;
     const repository=(trx?:any):any=>({
          async assertClinicalReview(){},
          async withTransaction(work:any){let release:any;const previous=queue;queue=new Promise(resolve=>release=resolve);await previous;const local=structuredClone(state);try{const result=await work(repository(local),local);state=local;return result;}finally{release();}},
          async findById(){return structuredClone((trx||state).prescription);},
          async findItemsByPrescriptionId(){return structuredClone((trx||state).items);},
          async findFulfillment(key:string){const sale=(trx||state).sales.find((sale:any)=>sale.key===key);return sale?{prescriptionId:'rx',saleId:sale.id,requestHash:'hash',lines:(trx||state).dispenses.map((line:any)=>({prescriptionItemId:line.prescriptionItemId,quantityDispensed:line.quantityDispensed}))}:null;},
          async applyFulfillment(_id:string,updates:any[],status:string){if(fail)throw new Error('write failed');for(const update of updates)Object.assign(trx.items.find((item:any)=>item.id===update.id),update);trx.prescription.status=status;},
          async recordDispense(_sale:string,_rx:string,lines:any[]){trx.dispenses.push(...lines);},
          async markItemsReferred(_id:string,ids:string[],status:string){trx.items.filter((item:any)=>ids.includes(item.id)).forEach((item:any)=>item.status='referred');trx.prescription.status=status;},
     });
     const saleService:any={completeSale:vi.fn(async(input:any,_actor:number,trx:any,prescriptionId:string)=>{
          expect(trx).toBeTruthy();expect(prescriptionId).toBe('rx');
          const existing=trx.sales.find((sale:any)=>sale.key===input.idempotencyKey);if(existing)return existing.receipt;
          const receipt={id:'sale-'+trx.sales.length,receiptNumber:'PHM-1',total:input.lines.reduce((sum:number,line:any)=>sum+line.quantity,0),completedAt:new Date(),paymentMethod:'cash'};
          trx.sales.push({id:receipt.id,key:input.idempotencyKey,receipt});return receipt;
     })};
     return {service:new PrescriptionService(repository(),saleService),state:()=>state,fail:()=>fail=true,saleService};
}
const input=(quantity=3,key='request-123456')=>({idempotencyKey:key,paymentAccountId:1,paymentMethod:'cash' as const,lines:[{prescriptionItemId:'rx-item',quantityDispensed:quantity}]});
describe('prescription dispensing integrity',()=>{
     it('leaves omitted prescribing quantity for pharmacy confirmation',async()=>{
          const createPrescription=vi.fn();
          const service=new PrescriptionService({createPrescription} as any,{} as any);
          const result=await service.createPrescription({patientId:1,items:[{drugName:'Drug',dose:'500 mg',frequency:'Twice daily',duration:'5 days',route:'Oral'}]},2);
          expect(result.items[0].quantityOrdered).toBe(0);
          expect(result.items[0].status).toBe('pending');
          expect(createPrescription).toHaveBeenCalledOnce();
     });
     it('blocks dispensing before the pharmacist confirms supply quantity',async()=>{
          const f=fixture();f.state().items[0].quantityOrdered=0;
          await expect(f.service.fulfill('rx',input(),2)).rejects.toThrow('confirm the supply quantity');
          expect(f.saleService.completeSale).not.toHaveBeenCalled();
     });

     it('rejects duplicate prescription item ids before creating a sale',async()=>{
          const f=fixture();await expect(f.service.fulfill('rx',{...input(),lines:[...input().lines,...input().lines]},2)).rejects.toThrow('Duplicate');expect(f.saleService.completeSale).not.toHaveBeenCalled();
     });
     it('marks the first partial dispensing partially fulfilled',async()=>{
          const f=fixture();const result=await f.service.fulfill('rx',input(),2);expect(result.prescription.status).toBe('partially_fulfilled');expect(f.state().items[0].quantityDispensed).toBe(3);expect(f.state().dispenses).toHaveLength(1);
     });
     it('rolls back the sale when writing the prescription fails',async()=>{
          const f=fixture();f.fail();await expect(f.service.fulfill('rx',input(),2)).rejects.toThrow('write failed');expect(f.state().sales).toHaveLength(0);expect(f.state().items[0].quantityDispensed).toBe(0);
     });
     it('serializes competing dispensers against the remaining quantity',async()=>{
          const f=fixture();const results=await Promise.allSettled([f.service.fulfill('rx',input(7,'request-first'),2),f.service.fulfill('rx',input(7,'request-second'),3)]);
          expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(f.state().sales).toHaveLength(1);expect(f.state().items[0].quantityDispensed).toBe(7);
     });
     it('returns the original result on retry after the prescription is closed',async()=>{
          const f=fixture();await f.service.fulfill('rx',input(10),2);const result=await f.service.fulfill('rx',input(10),2);expect(result.prescription.status).toBe('fulfilled');expect(f.state().sales).toHaveLength(1);expect(f.state().dispenses).toHaveLength(1);
     });
     it('rejects a retry with altered dispensing quantities',async()=>{
          const f=fixture();await f.service.fulfill('rx',input(),2);await expect(f.service.fulfill('rx',input(4),2)).rejects.toThrow('retry quantities');expect(f.state().sales).toHaveLength(1);
     });
     it('does not dispense a referred item',async()=>{
          const f=fixture();await f.service.referRemaining('rx',2);await expect(f.service.fulfill('rx',input(),2)).rejects.toThrow('already referred');expect(f.state().sales).toHaveLength(0);
     });
});
