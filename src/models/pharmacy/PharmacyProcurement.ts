import {randomUUID} from 'crypto';
import Decimal from 'decimal.js';
import {PharmacyEnterpriseCore,requiredText,requireManager,stockQuantity} from './PharmacyEnterpriseCore';
import {money,quantity} from './PharmacyRules';
import {roleAllowed} from '../../middleware/roles';
export class PharmacyProcurement extends PharmacyEnterpriseCore{
     async request(input:any){return this.atomic(input,'purchase_requisition',async trx=>{
          if(input.schemaVersion!==undefined&&input.schemaVersion!==1&&input.schemaVersion!==2)throw new Error('Unsupported purchase request version');
          if(input.schemaVersion!==1)return this.requestRequisition(trx,input);
          if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100||new Set(input.lines.map((line:any)=>line.itemId)).size!==input.lines.length)throw new Error('Choose up to 100 distinct medicines');const lines=[];let total=new Decimal(0);
          if(!await trx('pharmacy_suppliers').where({id:input.supplierId,branchid:this.branch,is_active:true}).first())throw new Error('Select a pharmacy supplier');
          for(const line of input.lines){const item=await this.item(trx,line.itemId),count=stockQuantity(line.quantity);if(typeof line.unitCost!=='number'||!Number.isFinite(line.unitCost)||line.unitCost<0||money(line.unitCost)!==line.unitCost)throw new Error('Enter valid quoted unit costs');const amount=money(new Decimal(count).mul(line.unitCost));total=total.plus(amount);lines.push({itemId:item.id,name:item.name,sku:item.sku,quantity:count,unitCost:line.unitCost});}
          const id=randomUUID(),reason=String(input.notes||input.reason||'Purchase request for pharmacy stock').trim(),estimatedValue=money(total);await trx('pharmacy_workflows').insert({id,branchid:this.branch,kind:'purchase_requisition',status:'requested',version:1,created_by:this.actor,reason:requiredText(reason,'purchase reason',500),details:JSON.stringify({lines,estimatedValue,quotes:[{supplierId:input.supplierId,reference:'Initial supplier estimate',lines,total:estimatedValue,recordedBy:this.actor}]}),created_at:new Date(),updated_at:new Date()});await this.event(trx,'purchase_requested',{estimatedValue},id);return {id,status:'requested',requiresApproval:true,version:1};
     });}
     async quote(id:string,input:any){return this.atomic(input,'purchase_quote:'+id,async trx=>{
          const row=await this.workflow(trx,id,'purchase_requisition');this.version(row,input);if(row.status!=='requested'&&!(row.details.schemaVersion===2&&row.status==='approved'))throw new Error('This request no longer accepts quotations');if(!await trx('pharmacy_suppliers').where({id:input.supplierId,branchid:this.branch,is_active:true}).first())throw new Error('Supplier not found');
          if(!Array.isArray(input.lines)||input.lines.length!==row.details.lines.length||new Set(input.lines.map((line:any)=>line.itemId)).size!==input.lines.length)throw new Error('Quote each requested medicine exactly once');let total=new Decimal(0);
          const lines=input.lines.map((line:any)=>{const requested=row.details.lines.find((item:any)=>item.itemId===line.itemId);if(!requested||typeof line.unitCost!=='number'||!Number.isFinite(line.unitCost)||line.unitCost<0||money(line.unitCost)!==line.unitCost)throw new Error('Invalid quotation line');total=total.plus(money(new Decimal(Number(requested.quantity)).mul(line.unitCost)));return {...requested,unitCost:line.unitCost};});
          const quote={supplierId:input.supplierId,reference:requiredText(input.reference,'quotation reference',120),lines,total:money(total),recordedBy:this.actor,recordedAt:new Date().toISOString()};return this.status(trx,row,row.status,{...row.details,quotes:[...(row.details.quotes||[]),quote]});
     });}
     async decide(id:string,input:any){requireManager(this.user);return this.atomic(input,'purchase_decide:'+id,async trx=>{
          const row=await this.workflow(trx,id,'purchase_requisition');
          this.version(row,input);
          if(row.status!=='requested')throw new Error('This purchase request has already been decided');
          const selfReview=Number(row.created_by)===this.actor;
          if(selfReview&&!roleAllowed(this.user.role,['admin']))throw new Error('A different manager or administrator must approve or reject the purchase request');
          const reason=requiredText(input.reason,'approval decision');
          if(selfReview){
               if(input.adminSelfReview!==true)throw new Error('Confirm the administrator self-review acknowledgement.');
               if(reason.length<10)throw new Error('Enter an administrator self-review reason of at least 10 characters.');
          }
          if(!['approve','reject'].includes(input.decision))throw new Error('Choose approve or reject');
          const reviewDetails={...row.details,decisionReason:reason,decidedBy:this.actor,...(selfReview?{adminSelfReview:true,adminSelfReviewBy:this.actor}:{})};
          if(selfReview)await this.event(trx,'purchase_admin_self_review',{
               requestId:row.id,requestedBy:Number(row.created_by),decision:input.decision,reason,role:this.user.role,expectedVersion:Number(row.version),
               ...(input.decision==='approve'?{quoteIndex:input.quoteIndex}:{})
          },row.id);
          if(input.decision==='reject'){
               await trx('pharmacy_workflows').where({id}).update({reviewed_by:this.actor});
               return this.status(trx,row,'rejected',reviewDetails);
          }
          if(row.details.schemaVersion===2){
               const amendments=input.lines;
               if(amendments!==undefined&&(!Array.isArray(amendments)||amendments.length!==row.details.lines.length||new Set(amendments.map((line:any)=>line.itemId)).size!==amendments.length))throw new Error('Review each requested medicine exactly once');
               const lines=[];
               for(const line of row.details.lines){
                    const amendment=amendments?.find((value:any)=>value.itemId===line.itemId);
                    if(amendments&&!amendment)throw new Error('Review each requested medicine exactly once');
                    const approvedQuantity=stockQuantity(amendment?amendment.approvedQuantity:line.quantity,true);
                    const item=await this.item(trx,line.itemId);if(!item.is_active)throw new Error('An approved medicine is inactive');
                    const changed=approvedQuantity!==Number(line.quantity);
                    lines.push({...line,requestedQuantity:Number(line.quantity),approvedQuantity,...(changed?{amendmentReason:requiredText(amendment?.reason,'quantity amendment reason',500)}:{})});
               }
               if(!lines.some((line:any)=>line.approvedQuantity>0))throw new Error('Approve at least one medicine quantity or reject the request');
               await trx('pharmacy_workflows').where({id}).update({reviewed_by:this.actor});
               return this.status(trx,row,'approved',{...reviewDetails,lines,approvedBy:this.actor,approvedAt:new Date().toISOString(),orders:[]});
          }
          if(!Number.isInteger(input.quoteIndex))throw new Error('Select an approved quotation');
          const quote=row.details.quotes[input.quoteIndex];if(!quote)throw new Error('Quotation not found');
          if(!await trx('pharmacy_suppliers').where({id:quote.supplierId,branchid:this.branch,is_active:true}).first())throw new Error('Approved supplier is unavailable');for(const line of quote.lines){const item=await this.item(trx,line.itemId);if(!item.is_active)throw new Error('An approved medicine is inactive');}
          const orderId=randomUUID();await trx('pharmacy_purchase_orders').insert({id:orderId,branchid:this.branch,supplier_id:quote.supplierId,status:'ordered',total_amount:quote.total,created_by:this.actor,notes:'Approved request '+id+': '+reason,created_at:new Date()});await trx('pharmacy_purchase_order_lines').insert(quote.lines.map((line:any)=>({id:randomUUID(),order_id:orderId,item_id:line.itemId,quantity_ordered:line.quantity,quantity_received:0,unit_cost:line.unitCost})));
          await trx('pharmacy_documents').insert({id:randomUUID(),branchid:this.branch,kind:'purchase_order',request_key:'approved-request:'+id,request_hash:id,supplier_id:quote.supplierId,amount:quote.total,details:JSON.stringify({requestId:id,orderId,lines:quote.lines}),created_by:this.actor,created_at:new Date()});await trx('pharmacy_workflows').where({id}).update({reviewed_by:this.actor});return this.status(trx,row,'approved',{...reviewDetails,orderId,selectedQuote:input.quoteIndex,approvedBy:this.actor});
     });}
     private async requestRequisition(trx:any,input:any){
          if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100||new Set(input.lines.map((line:any)=>line.itemId)).size!==input.lines.length)throw new Error('Choose up to 100 distinct medicines');
          const lines=[];let total=new Decimal(0),complete=true;
          for(const line of input.lines){
               const item=await this.item(trx,line.itemId);if(!item.is_active)throw new Error('A requested medicine is inactive');
               const count=stockQuantity(line.quantity),cost=line.unitCost;
               if(cost!==undefined&&cost!==null&&(typeof cost!=='number'||!Number.isFinite(cost)||cost<0||money(cost)!==cost))throw new Error('Enter valid estimated unit costs');
               const unitCost=cost??null;if(unitCost===null)complete=false;else total=total.plus(money(new Decimal(count).mul(unitCost)));
               lines.push({itemId:item.id,name:item.name,sku:item.sku,unit:item.unit||null,quantity:count,requestedQuantity:count,unitCost});
          }
          const id=randomUUID(),reason=requiredText(input.notes||input.reason,'purchase reason',500);
          await trx('pharmacy_workflows').insert({id,branchid:this.branch,kind:'purchase_requisition',status:'requested',version:1,created_by:this.actor,reason,details:JSON.stringify({schemaVersion:2,lines,estimatedValue:complete?money(total):null,quotes:[],orders:[]}),created_at:new Date(),updated_at:new Date()});
          await this.event(trx,'purchase_requested',{schemaVersion:2,estimatedValue:complete?money(total):null},id);
          return {id,status:'requested',requiresApproval:true,version:1,schemaVersion:2};
     }
     async convert(id:string,input:any){requireManager(this.user);return this.atomic(input,'purchase_convert:'+id,async trx=>{
          const row=await this.workflow(trx,id,'purchase_requisition');this.version(row,input);
          if(row.details.schemaVersion!==2)throw new Error('Legacy requests create their order during approval');
          if(row.status!=='approved')throw new Error('Approve this requisition before ordering from a supplier');
          if(!await trx('pharmacy_suppliers').where({id:input.supplierId,branchid:this.branch,is_active:true}).first())throw new Error('Select an active pharmacy supplier');
          const reference=requiredText(input.reference,'supplier order reference',120);
          if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100||new Set(input.lines.map((line:any)=>line.itemId)).size!==input.lines.length)throw new Error('Choose distinct approved medicines to order');
          const orders=row.details.orders||[],lines=[];
          // A selected quotation is kept only as evidence; its prices are never copied onto the order.
          if(input.quoteIndex!==undefined){
               const quote=Number.isInteger(input.quoteIndex)?row.details.quotes?.[input.quoteIndex]:undefined;
               if(!quote||quote.supplierId!==input.supplierId)throw new Error('Select a quotation from this supplier');
          }
          for(const line of input.lines){
               const approved=row.details.lines.find((value:any)=>value.itemId===line.itemId);
               if(!approved)throw new Error('Only approved medicines can be ordered');
               const count=stockQuantity(line.quantity),allocated=quantity(orders.reduce((sum:number,order:any)=>sum+order.lines.filter((value:any)=>value.itemId===line.itemId).reduce((n:number,value:any)=>n+Number(value.quantity),0),0));
               if(quantity(allocated+count)>Number(approved.approvedQuantity))throw new Error('Order quantity exceeds the remaining approved quantity');
               const item=await this.item(trx,line.itemId);if(!item.is_active)throw new Error('An ordered medicine is inactive');
               // Supplier orders are quantity-only; any submitted cost is ignored because actual costs are entered on receipt.
               lines.push({...approved,quantity:count,unitCost:null});
          }
          const orderId=randomUUID(),amount=null;
          await trx('pharmacy_purchase_orders').insert({id:orderId,branchid:this.branch,supplier_id:input.supplierId,status:'ordered',total_amount:amount,created_by:this.actor,notes:'Approved requisition '+id+': '+reference,created_at:new Date()});
          await trx('pharmacy_purchase_order_lines').insert(lines.map((line:any)=>({id:randomUUID(),order_id:orderId,item_id:line.itemId,quantity_ordered:line.quantity,quantity_received:0,unit_cost:null})));
          const result=await this.status(trx,row,'approved',{...row.details,orders:[...orders,{orderId,supplierId:input.supplierId,reference,quoteIndex:input.quoteIndex,lines,total:amount,orderedBy:this.actor,orderedAt:new Date().toISOString()}]});
          await this.event(trx,'purchase_order_converted',{orderId,supplierId:input.supplierId,lines,total:amount},id);
          return {...result,orderId};
     });}
}
