import {randomUUID} from 'crypto';
import {PharmacyEnterpriseCore,assertNoStockCount,assertBatchNotRecalled,dateOnly,json,requiredText,requireManager,stockQuantity} from './PharmacyEnterpriseCore';
import {assertPharmacyDayOpen,postPharmacyJournal} from './PharmacyLedger';
import {money,quantity} from './PharmacyRules';
import {roleAllowed} from '../../middleware/roles';

export class PharmacyStockWorkflows extends PharmacyEnterpriseCore{
     async list(kind:string){
          if(['nhis_claim','purchase_invoice'].includes(kind)&&!roleAllowed(this.user.role,['admin','pharmacy_manager','pharmacy_accountant']))throw new Error('Pharmacy finance authority is required');
          if(!['stock_count','transfer','supplier_return','purchase_invoice','purchase_requisition','cold_chain','delivery','nhis_claim'].includes(kind))throw new Error('Unknown workflow');
          const query=this.db('pharmacy_workflows').where({kind});
          query.where((q:any)=>q.where('branchid',this.branch).orWhere('target_branchid',this.branch));
          return (await query.orderBy('created_at','desc').limit(200)).map((row:any)=>({...row,details:json(row.details)}));
     }
     async detail(id:string){
          const row=await this.db('pharmacy_workflows').where({id}).first();if(!row||![Number(row.branchid),Number(row.target_branchid)].includes(this.branch))throw new Error('Workflow not found');
          if(['nhis_claim','purchase_invoice'].includes(row.kind)&&!roleAllowed(this.user.role,['admin','pharmacy_manager','pharmacy_accountant']))throw new Error('Pharmacy finance authority is required');
          const [lines,events]=await Promise.all([this.db('pharmacy_workflow_lines').where({workflow_id:id}).orderBy('id'),this.db('pharmacy_enterprise_events').where({workflow_id:id}).orderBy('created_at')]);
          const details=json(row.details);
          return {...row,details,lines:lines.map((line:any)=>{const output={...line,details:json(line.details)};if(row.kind==='stock_count'&&row.status==='counting'){delete output.baseline;delete output.unit_cost;delete output.details.baselineStock;}return output;}),events:events.map((event:any)=>({...event,details:json(event.details)}))};
     }
     async createCount(input:any){
          if(!Array.isArray(input.itemIds)||!input.itemIds.length||input.itemIds.length>200||new Set(input.itemIds).size!==input.itemIds.length)throw new Error('Select 1 to 200 different medicines');
          const reason=requiredText(input.reason,'count purpose');
          return this.atomic(input,'stock_count',async trx=>{
               const id=randomUUID(),lines:any[]=[];
               for(const itemId of [...input.itemIds].sort()){
                    const item=await this.item(trx,itemId);await assertNoStockCount(trx,itemId);
                    const movements=await trx('pharmacy_stock_movements').where({item_id:itemId,branchid:this.branch});const batches=new Map<string,any>();
                    for(const row of movements){if(row.batch_number==null)continue;const entry=batches.get(row.batch_number)||{batch:row.batch_number,baseline:0,expiry:null};entry.baseline=quantity(entry.baseline+Number(row.new_stock)-Number(row.previous_stock));if(row.expiry_date){const expiry=dateOnly(row.expiry_date);entry.expiry=entry.expiry&&entry.expiry<expiry?entry.expiry:expiry;}batches.set(row.batch_number,entry);}
                    if([...batches.values()].some(batch=>batch.baseline<0))throw new Error('A batch has a negative ledger balance; reconcile it before counting');
                    const unbatched=quantity(Number(item.current_stock)-[...batches.values()].reduce((sum,batch)=>sum+batch.baseline,0));if(unbatched<0)throw new Error('Batch quantities exceed physical stock; reconcile the ledger before counting');
                    const entries=[...batches.values()].filter(batch=>batch.baseline>0);if(unbatched>0||!entries.length)entries.push({batch:null,baseline:unbatched,expiry:null});
                    for(const entry of entries)lines.push({id:randomUUID(),workflow_id:id,item_id:itemId,batch_number:entry.batch,expiry_date:entry.expiry,baseline:entry.baseline,quantity:entry.baseline,counted_quantity:null,unit_cost:Number(item.cost_price),details:JSON.stringify({name:item.name,sku:item.sku,unit:item.consumption_unit,baselineStock:Number(item.current_stock)})});
               }
               await trx('pharmacy_workflows').insert({id,branchid:this.branch,kind:'stock_count',status:'counting',version:1,created_by:this.actor,reason,details:JSON.stringify({blind:true,freeze:'Selected medicines cannot move until approved or cancelled'}),created_at:new Date(),updated_at:new Date()});
               await trx('pharmacy_workflow_lines').insert(lines);await this.event(trx,'count_started',{items:input.itemIds},id);return {id,status:'counting',version:1};
          });
     }
     async submitCount(id:string,input:any){return this.atomic(input,'count_submit:'+id,async trx=>{
          const row=await this.workflow(trx,id,'stock_count');this.version(row,input);if(row.status!=='counting')throw new Error('This count is not open for counting');
          const lines=await trx('pharmacy_workflow_lines').where({workflow_id:id}).forUpdate();
          if(!Array.isArray(input.lines)||input.lines.length!==lines.length||new Set(input.lines.map((line:any)=>line.id)).size!==lines.length)throw new Error('Count every line exactly once, including zero balances');
          for(const line of input.lines){if(!lines.some((saved:any)=>saved.id===line.id))throw new Error('Count line not found');stockQuantity(line.countedQuantity,true);await trx('pharmacy_workflow_lines').where({id:line.id,workflow_id:id}).update({counted_quantity:line.countedQuantity});}
          return this.status(trx,row,'submitted',{...row.details,countedBy:this.actor,countedAt:new Date().toISOString()});
     });}
     async approveCount(id:string,input:any){requireManager(this.user);return this.atomic(input,'count_approve:'+id,async trx=>{
          const row=await this.workflow(trx,id,'stock_count');this.version(row,input);if(row.status!=='submitted')throw new Error('Submit the count before approval');
          if([Number(row.created_by),Number(row.details.countedBy)].includes(this.actor))throw new Error('A different manager must approve the stock count');
          await assertPharmacyDayOpen(trx,this.branch);const lines=await trx('pharmacy_workflow_lines').where({workflow_id:id}).orderBy('item_id').forUpdate();let total=0;
          for(const itemId of [...new Set<string>(lines.map((line:any)=>line.item_id))].sort()){
               const item=await this.item(trx,itemId);await assertNoStockCount(trx,itemId,id);const itemLines=lines.filter((line:any)=>line.item_id===itemId);
               const expected=itemLines.reduce((sum:number,line:any)=>sum+Number(line.baseline),0);if(quantity(expected)!==quantity(Number(item.current_stock)))throw new Error('Stock changed during this count. Cancel and recount the affected medicines');
               for(const line of itemLines){if(line.counted_quantity==null)throw new Error('A count line has not been counted');const delta=quantity(Number(line.counted_quantity)-Number(line.baseline));if(delta){await this.move(trx,item,delta,line.batch_number,line.expiry_date,'Approved stock count: '+row.reason,id);total+=money(delta*Number(line.unit_cost));}}
          }
          total=money(total);if(total)await postPharmacyJournal(trx,this.branch,id,'stock_count','Approved stock count variance',this.actor,total>0?[{account:'inventory',debit:total},{account:'inventory_adjustments',credit:total}]:[{account:'inventory_adjustments',debit:-total},{account:'inventory',credit:-total}]);
          await trx('pharmacy_workflows').where({id}).update({reviewed_by:this.actor});return this.status(trx,row,'approved',{...row.details,varianceValue:total,approvalNote:requiredText(input.reason,'approval reason')});
     });}
     async cancelCount(id:string,input:any){return this.atomic(input,'count_cancel:'+id,async trx=>{const row=await this.workflow(trx,id,'stock_count');this.version(row,input);if(!['counting','submitted'].includes(row.status))throw new Error('This count cannot be cancelled');if(Number(row.created_by)!==this.actor)requireManager(this.user);return this.status(trx,row,'cancelled',{...row.details,cancellationReason:requiredText(input.reason,'cancellation reason')});});}
     async quarantine(input:any){return this.atomic(input,'quarantine',async trx=>{
          await assertPharmacyDayOpen(trx,this.branch);const item=await this.item(trx,input.itemId);await assertNoStockCount(trx,item.id);const count=stockQuantity(input.quantity),batch=input.batchNumber||null;
          const available=await this.batch(trx,item,batch);if(count>available.available)throw new Error('Insufficient stock in the selected batch');
          const id=randomUUID(),reason=requiredText(input.reason,'quarantine reason'),value=money(count*Number(item.cost_price));
          await this.move(trx,item,-count,batch,available.expiry,'Quarantine: '+reason,id);
          await trx('pharmacy_quarantine_lots').insert({id,branchid:this.branch,item_id:item.id,batch_number:batch,expiry_date:available.expiry,quantity:count,remaining_quantity:count,unit_cost:item.cost_price,book_value:value,source:'stock',reference_id:id,status:'held',reason,created_by:this.actor,created_at:new Date()});
          if(value)await postPharmacyJournal(trx,this.branch,id,'quarantine','Stock moved to quarantine',this.actor,[{account:'quarantine_inventory',debit:value},{account:'inventory',credit:value}]);
          await this.event(trx,'quarantined',{itemId:item.id,batch,quantity:count,reason},id);return {id,status:'held'};
     });}
     async quarantineLots(){return this.db('pharmacy_quarantine_lots as q').join('pharmacy_inventory_items as i','i.id','q.item_id').where('q.branchid',this.branch).select('q.*','i.name','i.sku').orderBy('q.created_at','desc').limit(200);}
     async resolveQuarantine(id:string,input:any){requireManager(this.user);return this.atomic(input,'quarantine_resolve:'+id,async trx=>{
          const lot=await trx('pharmacy_quarantine_lots').where({id,branchid:this.branch}).forUpdate().first();if(!lot||lot.status!=='held')throw new Error('Open quarantine lot not found');
          if(!['release','dispose'].includes(input.action))throw new Error('Choose release or dispose');const reason=requiredText(input.reason,'inspection decision');
          await assertPharmacyDayOpen(trx,this.branch);const count=Number(lot.remaining_quantity),value=Number(lot.book_value),item=await this.item(trx,lot.item_id);await assertNoStockCount(trx,item.id);
          if(input.action==='release'){
               if(lot.expiry_date&&dateOnly(lot.expiry_date)<new Date().toISOString().slice(0,10))throw new Error('Expired stock cannot be released');
               if(item.pharmacy_batch_tracking&&(!lot.batch_number||!lot.expiry_date))throw new Error('Tracked stock requires batch and expiry evidence before release');
               await assertBatchNotRecalled(trx,this.branch,item.id,lot.batch_number);const before=Number(item.current_stock);await this.move(trx,item,count,lot.batch_number,lot.expiry_date,'Inspected quarantine release: '+reason,id,Number(lot.unit_cost));
               const weighted=Number(item.current_stock)>0?(before*Number(item.cost_price)+count*Number(lot.unit_cost))/Number(item.current_stock):Number(lot.unit_cost);await trx('pharmacy_inventory_items').where({id:item.id}).update({cost_price:Number(weighted.toFixed(6))});
               const amount=value||money(count*Number(lot.unit_cost));if(amount)await postPharmacyJournal(trx,this.branch,id,'quarantine_release',reason,this.actor,[{account:'inventory',debit:amount},{account:lot.source==='customer_return'?'cost_of_sales':'quarantine_inventory',credit:amount}]);
          }else if(value)await postPharmacyJournal(trx,this.branch,id,'quarantine_disposal',reason,this.actor,[{account:'operating_expenses',debit:value},{account:'quarantine_inventory',credit:value}]);
          const status=input.action==='release'?'released':'disposed';await trx('pharmacy_quarantine_lots').where({id}).update({status,remaining_quantity:0,book_value:0});await this.event(trx,status,{reason,quantity:count,previousBookValue:value},id);return {id,status};
     });}
     async createTransfer(input:any){requireManager(this.user);return this.atomic(input,'transfer_create',async trx=>{
          if(!Number.isInteger(input.targetBranchId)||input.targetBranchId===this.branch||!await trx('branch').where({branchid:input.targetBranchId}).first())throw new Error('Select a different valid destination branch');
          const count=stockQuantity(input.quantity),item=await this.item(trx,input.itemId),target=await this.item(trx,input.targetItemId,input.targetBranchId);if(item.sku!==target.sku)throw new Error('Source and destination medicines must have the same SKU');
          const id=randomUUID(),reason=requiredText(input.reason,'transfer reason');
          await trx('pharmacy_workflows').insert({id,branchid:this.branch,target_branchid:input.targetBranchId,kind:'transfer',status:'requested',version:1,created_by:this.actor,reason,details:JSON.stringify({source:item.name,target:target.name}),created_at:new Date(),updated_at:new Date()});
          await trx('pharmacy_workflow_lines').insert({id:randomUUID(),workflow_id:id,item_id:item.id,target_item_id:target.id,batch_number:input.batchNumber||null,quantity:count,baseline:0,unit_cost:item.cost_price,details:JSON.stringify({name:item.name,sku:item.sku})});await this.event(trx,'transfer_requested',{destination:input.targetBranchId},id);return {id,status:'requested',version:1};
     });}
     async transferAction(id:string,input:any){requireManager(this.user);return this.atomic(input,'transfer_'+input.action+':'+id,async trx=>{
          const receive=input.action==='receive',row=await this.workflow(trx,id,'transfer',receive);this.version(row,input);await assertPharmacyDayOpen(trx,this.branch);
          const line=await trx('pharmacy_workflow_lines').where({workflow_id:id}).first(),count=Number(line.quantity),reason=requiredText(input.reason,'transfer confirmation');
          if(input.action==='dispatch'){
               if(row.status!=='requested')throw new Error('Only requested transfers can be dispatched');const item=await this.item(trx,line.item_id);await assertNoStockCount(trx,item.id);await assertBatchNotRecalled(trx,this.branch,item.id,line.batch_number);
               const batch=await this.batch(trx,item,line.batch_number);if(batch.available<count)throw new Error('Insufficient batch stock');if(batch.expiry&&batch.expiry<new Date().toISOString().slice(0,10))throw new Error('Expired stock cannot be dispatched');
               const value=money(count*Number(item.cost_price));await this.move(trx,item,-count,line.batch_number,batch.expiry,'Transfer dispatch: '+reason,id);await trx('pharmacy_workflow_lines').where({id:line.id}).update({unit_cost:item.cost_price,expiry_date:batch.expiry});
               if(value)await postPharmacyJournal(trx,this.branch,id,'transfer_dispatch',reason,this.actor,[{account:'stock_in_transit',debit:value},{account:'inventory',credit:value}]);return this.status(trx,row,'in_transit',{...row.details,dispatchedBy:this.actor,dispatchedAt:new Date().toISOString()});
          }
          if(receive){
               if(row.status!=='in_transit')throw new Error('Only dispatched transfers can be received');if(stockQuantity(input.receivedQuantity)!==count)throw new Error('Confirm the full received quantity. Record damaged or missing goods as a transfer discrepancy before receipt');
               const item=await this.item(trx,line.target_item_id);await assertNoStockCount(trx,item.id);await assertBatchNotRecalled(trx,this.branch,item.id,line.batch_number);if(line.expiry_date&&dateOnly(line.expiry_date)<new Date().toISOString().slice(0,10))throw new Error('Expired goods require quarantine and discrepancy handling');
               const before=Number(item.current_stock),cost=Number(line.unit_cost),value=money(count*cost);await this.move(trx,item,count,line.batch_number,line.expiry_date,'Transfer receipt: '+reason,id,cost);await trx('pharmacy_inventory_items').where({id:item.id}).update({cost_price:Number(((before*Number(item.cost_price)+count*cost)/(before+count)).toFixed(6))});
               // The transit clearing entry belongs to the sending branch; the receipt creates an interbranch balance.
               await assertPharmacyDayOpen(trx,Number(row.branchid));if(value){await postPharmacyJournal(trx,this.branch,id,'transfer_receive',reason,this.actor,[{account:'inventory',debit:value},{account:'interbranch_payable:'+row.branchid,credit:value}]);await postPharmacyJournal(trx,Number(row.branchid),id,'transfer_clear',reason,this.actor,[{account:'interbranch_receivable:'+this.branch,debit:value},{account:'stock_in_transit',credit:value}]);}
               return this.status(trx,row,'received',{...row.details,receivedBy:this.actor,receivedAt:new Date().toISOString()});
          }
          if(input.action==='cancel'&&row.status==='requested')return this.status(trx,row,'cancelled',{...row.details,cancellationReason:reason});
          throw new Error('Invalid transfer action or state');
     });}
}
