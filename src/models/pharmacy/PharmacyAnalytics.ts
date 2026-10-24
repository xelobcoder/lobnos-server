import { money } from './PharmacyRules';
import { pharmacyAvailability } from './PharmacyAvailability';

export const PHARMACY_REPORTS=['overview','sales','inventory','expiry','procurement','suppliers','movements','finance'] as const;
export type PharmacyReport=typeof PHARMACY_REPORTS[number];
export function pharmacyAnalyticsFilters(input:any={},today=new Date().toISOString().slice(0,10)) {
     const end=input.to||today;
     if(typeof end!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(Date.parse(end)))throw new Error('Select valid report dates');
     const start=input.from||new Date(Date.parse(end)-29*86400000).toISOString().slice(0,10);
     for(const value of [start,end])if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('Select valid report dates');
     if(start>end)throw new Error('The start date must be on or before the end date');
     if(!PHARMACY_REPORTS.includes(input.report||'overview'))throw new Error('Unknown pharmacy report');
     const page=Number(input.page||1),count=Number(input.count||25);
     if(!Number.isInteger(page)||page<1||!Number.isInteger(count)||count<1||count>200)throw new Error('Invalid report page or page size');
     const next=new Date(Date.parse(end)+86400000).toISOString().slice(0,10);
     return {from:start,to:end,next,days:Math.floor((Date.parse(end)-Date.parse(start))/86400000)+1,report:(input.report||'overview') as PharmacyReport,page,count,search:String(input.search||'').trim().slice(0,100)};
}
type Filters=ReturnType<typeof pharmacyAnalyticsFilters>;
function between(query:any,column:string,f:Filters){return query.where(column,'>=',f.from).where(column,'<',f.next);}
export function pharmacySalesReportQuery(db:any,branch:number,f:Filters) {
     const sold='s.completed_at >= ? AND s.completed_at < ?',refunded='s.reversed_at >= ? AND s.reversed_at < ?';
     const range=[f.from,f.next];
     const query=db('pharmacy_sale_lines as l').join('pharmacy_sales as s','s.id','l.sale_id')
          .leftJoin('pharmacy_returns as r',function(this:any){this.on('r.sale_id','s.id').andOn('r.inventory_item_id','l.inventory_item_id');})
          .where('s.branchid',branch).where((q:any)=>{between(q,'s.completed_at',f).orWhere((r:any)=>between(r,'s.reversed_at',f));})
          .select('l.inventory_item_id as itemId').select(db.raw('MAX(l.item_name_snapshot) as medicine'),db.raw('MAX(l.sku_snapshot) as sku'))
          .select(db.raw(`SUM(CASE WHEN ${sold} THEN l.quantity ELSE 0 END) as soldUnits`,range))
          .select(db.raw(`SUM(CASE WHEN ${refunded} THEN l.quantity ELSE 0 END) as refundedUnits`,range))
          .select(db.raw(`SUM(CASE WHEN ${sold} THEN l.line_total ELSE 0 END) as grossSales`,range))
          .select(db.raw(`SUM(CASE WHEN ${refunded} THEN l.line_total ELSE 0 END) as refunds`,range))
          .select(db.raw(`SUM(CASE WHEN ${sold} THEN l.line_cost ELSE 0 END) - SUM(CASE WHEN ${refunded} AND r.disposition = 'restock' THEN l.line_cost ELSE 0 END) as costOfSales`,[...range,...range]))
          .groupBy('l.inventory_item_id');
     if(f.search)query.where((q:any)=>q.where('l.item_name_snapshot','like','%'+f.search+'%').orWhere('l.sku_snapshot','like','%'+f.search+'%'));
     return query;
}
export class PharmacyAnalytics {
     constructor(private readonly db:any,private readonly branch:number,private readonly exportAll=false){if(!Number.isInteger(branch)||branch<=0)throw new Error('Select an operating branch');}
     private async page(query:any,f:Filters,sort:string){
          if(this.exportAll){const rows=await query.clone().orderBy(sort,'desc');return {rows,total:rows.length,page:1,count:rows.length,totalPages:1};}
          const [rows,total]=await Promise.all([query.clone().orderBy(sort,'desc').limit(f.count).offset((f.page-1)*f.count),this.db.from(query.clone().as('report_rows')).count('* as total').first()]);
          return {rows,total:Number(total?.total||0),page:f.page,count:f.count,totalPages:Math.max(1,Math.ceil(Number(total?.total||0)/f.count))};
     }
     async report(input:any={}){
          const f=pharmacyAnalyticsFilters(input),db=this.db,branch=this.branch;
          const sales=()=>between(db('pharmacy_sales').where({branchid:branch}),'completed_at',f);
          const refunds=()=>between(db('pharmacy_sales').where({branchid:branch}).whereNotNull('reversed_at'),'reversed_at',f);
          const stock=()=>db('pharmacy_inventory_items').where({branchid:branch});
          const journals=()=>db('pharmacy_journal_lines as l').join('pharmacy_journals as j','j.id','l.journal_id').where('j.branchid',branch).where('j.financial_date','>=',f.from).where('j.financial_date','<=',f.to);
          const [sold,returned,inventory,ledger]=await Promise.all([
               sales().sum('total_amount as amount').sum('total_cost as cost').count('* as count').first(),refunds().sum('total_amount as amount').count('* as count').first(),
               stock().select(db.raw('COUNT(*) as medicines'),db.raw('COALESCE(SUM(current_stock * cost_price),0) as stockValue'),db.raw('SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) as reorderItems'),db.raw('SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as outOfStock')).first(),
               journals().select('l.account_code').sum('l.debit as debit').sum('l.credit as credit').groupBy('l.account_code'),
          ]);
          const balance=(code:string)=>ledger.filter((row:any)=>row.account_code===code).reduce((sum:number,row:any)=>sum+Number(row.debit)-Number(row.credit),0);
          const stockRows=await stock().select('id','current_stock','min_stock','pharmacy_batch_tracking');
          const branchAvailability=await pharmacyAvailability(db,stockRows.map((row:any)=>({id:row.id,currentStock:Number(row.current_stock),batchTracking:Boolean(row.pharmacy_batch_tracking)})));
          const summary={grossSales:money(sold?.amount||0),refunds:money(returned?.amount||0),netSales:money(Number(sold?.amount||0)-Number(returned?.amount||0)),receipts:Number(sold?.count||0),refundCount:Number(returned?.count||0),stockValue:money(inventory?.stockValue||0),medicines:Number(inventory?.medicines||0),reorderItems:stockRows.filter((row:any)=>(branchAvailability.get(row.id)||0)<=Number(row.min_stock)).length,outOfStock:stockRows.filter((row:any)=>(branchAvailability.get(row.id)||0)<=0).length,bookRevenue:money(-balance('sales')),costOfSales:money(balance('cost_of_sales')),operatingExpenses:money(balance('operating_expenses')),profit:money(-balance('sales')-balance('cost_of_sales')-balance('operating_expenses'))};
          let result:any,columns:Array<{key:string;label:string;format?:string}>=[];
          const col=(key:string,label:string,format?:string)=>({key,label,format});
          if(f.report==='sales'){
               result=await this.page(pharmacySalesReportQuery(db,branch,f),f,'grossSales');
               result.rows=result.rows.map((row:any)=>{const net=money(Number(row.grossSales)-Number(row.refunds)),profit=money(net-Number(row.costOfSales));return {...row,netSales:net,grossProfit:profit,margin:net>0?money(profit/net*100):null};});
               columns=[col('medicine','Medicine'),col('sku','SKU'),col('soldUnits','Units sold','number'),col('refundedUnits','Units refunded','number'),col('grossSales','Gross sales','money'),col('refunds','Refunds','money'),col('netSales','Net sales','money'),col('costOfSales','Cost of sales','money'),col('grossProfit','Gross profit','money'),col('margin','Margin %','number')];
          }else if(f.report==='inventory'){
               const usage=between(db('pharmacy_stock_movements').where({branchid:branch,transaction_type:'consumption'}),'transaction_date',f).select('item_id').sum('quantity as issued').groupBy('item_id').as('usage');
               const query=db('pharmacy_inventory_items as i').leftJoin(usage,'usage.item_id','i.id').where('i.branchid',branch).select('i.*','usage.issued').select(db.raw('i.current_stock * i.cost_price as stockValue'),db.raw('i.current_stock * i.sale_price as retailValue'),db.raw('GREATEST(i.min_stock - i.current_stock,0) as reorderQuantity'));
               if(f.search)query.where((q:any)=>q.where('i.name','like','%'+f.search+'%').orWhere('i.sku','like','%'+f.search+'%'));
               result=await this.page(query,f,'stockValue');
               result.rows=result.rows.map((row:any)=>({...row,dispensable:branchAvailability.get(row.id)||0,reorderQuantity:Math.max(0,Number(row.min_stock)-(branchAvailability.get(row.id)||0)),dailyUsage:Number(row.issued||0)/f.days,daysCover:Number(row.issued)>0?money((branchAvailability.get(row.id)||0)/(Number(row.issued)/f.days)):null}));
               columns=[col('name','Medicine'),col('sku','SKU'),col('current_stock','Physical stock','number'),col('dispensable','Dispensable','number'),col('min_stock','Reorder level','number'),col('reorderQuantity','Reorder quantity','number'),col('stockValue','Cost value','money'),col('retailValue','Retail value','money'),col('dailyUsage','Daily usage','number'),col('daysCover','Days of cover','number')];
          }else if(f.report==='expiry'){
               const query=db('pharmacy_stock_movements as m').join('pharmacy_inventory_items as i','i.id','m.item_id').where('m.branchid',branch).where('i.branchid',branch).whereNotNull('m.batch_number').select('m.item_id as itemId','m.batch_number as batch').select(db.raw('MAX(i.name) as medicine'),db.raw('MIN(m.expiry_date) as expiry'),db.raw('SUM(m.new_stock-m.previous_stock) as available'),db.raw('SUM(m.new_stock-m.previous_stock)*MAX(i.cost_price) as stockValue')).groupBy('m.item_id','m.batch_number').havingRaw('SUM(m.new_stock-m.previous_stock)>0');
               if(f.search)query.where((q:any)=>q.where('i.name','like','%'+f.search+'%').orWhere('i.sku','like','%'+f.search+'%').orWhere('m.batch_number','like','%'+f.search+'%'));
               result=await this.page(query,f,'stockValue');const today=new Date().toISOString().slice(0,10);
               result.rows=result.rows.map((row:any)=>{const expiry=row.expiry?new Date(row.expiry).toISOString().slice(0,10):null,days=expiry?Math.floor((Date.parse(expiry)-Date.parse(today))/86400000):null;return {...row,expiry,daysToExpiry:days,status:days===null?'Expiry missing':days<0?'Expired':days<=90?'Expires within 90 days':'In date'};});
               columns=[col('medicine','Medicine'),col('batch','Batch'),col('expiry','Expiry','date'),col('available','On hand','number'),col('daysToExpiry','Days to expiry','number'),col('stockValue','Value at risk','money'),col('status','Status')];
          }else if(f.report==='procurement'||f.report==='suppliers'){
               const query=db('pharmacy_purchase_order_lines as l').join('pharmacy_purchase_orders as o','o.id','l.order_id').join('pharmacy_suppliers as supplier','supplier.id','o.supplier_id').join('pharmacy_inventory_items as i','i.id','l.item_id').where('o.branchid',branch).where('supplier.branchid',branch);
               between(query,'o.created_at',f);if(f.search)query.where((q:any)=>q.where('supplier.name','like','%'+f.search+'%').orWhere('i.name','like','%'+f.search+'%'));
               if(f.report==='procurement'){
                    query.select('o.id','supplier.name as supplier','i.name as medicine','o.status','o.created_at as orderedAt','l.quantity_ordered as ordered','l.quantity_received as received','l.unit_cost as unitCost').select(db.raw("CASE WHEN o.status='cancelled' THEN 0 ELSE GREATEST(l.quantity_ordered-l.quantity_received,0) END as outstanding"),db.raw('l.quantity_ordered*l.unit_cost as value'));
                    columns=[col('supplier','Supplier'),col('medicine','Medicine'),col('orderedAt','Ordered','date'),col('status','Status'),col('ordered','Ordered units','number'),col('received','Received units','number'),col('outstanding','Outstanding units','number'),col('unitCost','Unit cost','money'),col('value','Order value','money')];result=await this.page(query,f,'orderedAt');
               }else{
                    query.whereNot('o.status','cancelled').select('supplier.id','supplier.name as supplier').countDistinct('o.id as orders').sum('l.quantity_ordered as ordered').sum('l.quantity_received as received').select(db.raw('SUM(l.quantity_ordered*l.unit_cost) as value'),db.raw('AVG(CASE WHEN l.quantity_ordered>0 THEN l.quantity_received/l.quantity_ordered ELSE 0 END)*100 as fillRate')).groupBy('supplier.id','supplier.name');
                    result=await this.page(query,f,'value');
                    columns=[col('supplier','Supplier'),col('orders','Orders','number'),col('ordered','Units ordered','number'),col('received','Units received','number'),col('fillRate','Average line fill %','number'),col('value','Order value','money')];
               }
          }else if(f.report==='movements'){
               const query=between(db('pharmacy_stock_movements as m').join('pharmacy_inventory_items as i','i.id','m.item_id').where('m.branchid',branch).where('i.branchid',branch),'m.transaction_date',f).select('m.id','i.name as medicine','m.transaction_date as occurredAt','m.transaction_type as type','m.quantity','m.previous_stock as previousStock','m.new_stock as newStock','m.batch_number as batch','m.total_cost as value','m.reason','m.performed_by as employeeId');
               if(f.search)query.where((q:any)=>q.where('i.name','like','%'+f.search+'%').orWhere('i.sku','like','%'+f.search+'%').orWhere('m.batch_number','like','%'+f.search+'%'));
               result=await this.page(query,f,'occurredAt');columns=[col('occurredAt','Date','date'),col('medicine','Medicine'),col('type','Movement'),col('quantity','Quantity','number'),col('previousStock','Before','number'),col('newStock','After','number'),col('batch','Batch'),col('value','Cost','money'),col('reason','Reason'),col('employeeId','Staff ID')];
          }else if(f.report==='finance'){
               const query=journals().select('l.account_code as account').sum('l.debit as debit').sum('l.credit as credit').groupBy('l.account_code');
               const [accounts,suppliers]=await Promise.all([db('pharmacy_collection_accounts').where({branchid:branch}).select('id','name'),db('pharmacy_suppliers').where({branchid:branch}).select('id','name')]);
               const names:Record<string,string>={sales:'Pharmacy sales',inventory:'Pharmacy stock',cost_of_sales:'Cost of sales',operating_expenses:'Operating expenses',opening_equity:'Opening equity',...Object.fromEntries(accounts.map((row:any)=>['collection:'+row.id,row.name])),...Object.fromEntries(suppliers.map((row:any)=>['payable:'+row.id,'Payable: '+row.name]))};
               result=await this.page(query,f,'debit');result.rows=result.rows.map((row:any)=>({...row,accountName:names[row.account]||row.account,balance:money(Number(row.debit)-Number(row.credit))}));columns=[col('accountName','Account'),col('debit','Debits','money'),col('credit','Credits','money'),col('balance','Net debit / (credit)','money')];
          }else{
               const recorded=await sales().select(db.raw('DATE(completed_at) as date')).sum('total_amount as sales').count('* as receipts').groupByRaw('DATE(completed_at)').orderBy('date');
               const returned=await refunds().select(db.raw('DATE(reversed_at) as date')).sum('total_amount as refunds').groupByRaw('DATE(reversed_at)');
               const dates=[...new Set([...recorded,...returned].map((row:any)=>new Date(row.date).toISOString().slice(0,10)))].sort();
               result={rows:dates.map(date=>{const sale=recorded.find((row:any)=>new Date(row.date).toISOString().slice(0,10)===date),refund=returned.find((row:any)=>new Date(row.date).toISOString().slice(0,10)===date);return {date,sales:Number(sale?.sales||0),refunds:Number(refund?.refunds||0),netSales:money(Number(sale?.sales||0)-Number(refund?.refunds||0)),receipts:Number(sale?.receipts||0)};}),total:dates.length,page:1,count:dates.length,totalPages:1};
               columns=[col('date','Date','date'),col('sales','Gross sales','money'),col('refunds','Refunds','money'),col('netSales','Net sales','money'),col('receipts','Receipts','number')];
          }
          return {...result,summary,columns,filters:f,asOf:new Date().toISOString(),scope:'Current branch. Inventory and expiry are current snapshots; other reports use the selected event dates.'};
     }
}
