import {pharmacyAnalyticsFilters} from './PharmacyAnalytics';
import {pharmacyAvailability} from './PharmacyAvailability';
import {json} from './PharmacyEnterpriseCore';

export const ITEM_ANALYTICS_SECTIONS = ['summary', 'orders', 'usage', 'wastage', 'dispensing', 'supplier-performance', 'movements'] as const;
const column = (key: string, label: string, format = 'text') => ({key, label, format});

export class PharmacyItemAnalytics {
  constructor(private readonly db: any, private readonly branch: number) {
    if (!Number.isSafeInteger(branch) || branch < 1) throw new Error('Select an operating branch');
  }
  async report(itemId: string, section: string, input: any = {}) {
    if (!ITEM_ANALYTICS_SECTIONS.includes(section as typeof ITEM_ANALYTICS_SECTIONS[number])) throw new Error('Unknown item analytics page');
    const filters = pharmacyAnalyticsFilters({...input, report: 'movements'});
    const period = String(input.period || 'daily');
    if (!['daily', 'monthly', 'yearly'].includes(period)) throw new Error('Choose a daily, monthly or yearly period');
    const item = await this.db('pharmacy_inventory_items').where({id: itemId, branchid: this.branch}).first();
    if (!item) throw new Error('Medicine not found in this branch');
    const db = this.db;
    const dated = (query: any, field: string) => query.where(field, '>=', filters.from).where(field, '<', filters.next);
    const periodSql = (field: string) => `SUBSTR(${field},1,${period === 'daily' ? 10 : period === 'monthly' ? 7 : 4})`;
    const movements = () => dated(db('pharmacy_stock_movements as m').where({'m.item_id': itemId, 'm.branchid': this.branch}), 'm.transaction_date');
    const orders = () => dated(db('pharmacy_purchase_order_lines as l')
      .join('pharmacy_purchase_orders as o', 'o.id', 'l.order_id')
      .join('pharmacy_suppliers as s', 's.id', 'o.supplier_id')
      .leftJoin('pharmacy_workflows as w', function(this:any) {this.on('w.id','o.id').andOn('w.branchid','o.branchid').andOnVal('w.kind','supplier_purchase_order');})
      .where({'l.item_id': itemId, 'o.branchid': this.branch, 's.branchid': this.branch}), 'o.created_at');
    const orderQuery = () => {
      const query = orders();
      if (input.supplierId) query.where('s.id', String(input.supplierId));
      if (filters.search) query.where((q: any) => q.where('s.name', 'like', `%${filters.search}%`).orWhere('w.details', 'like', `%${filters.search}%`).orWhere('o.id','like',`%${filters.search.replace(/^PO-/i,'')}%`));
      return query;
    };
    const scopedMovements = () => {
      const query = movements();
      if (filters.search) query.where((q: any) => q.where('m.batch_number', 'like', `%${filters.search}%`).orWhere('m.reason', 'like', `%${filters.search}%`).orWhere('m.reference_id', 'like', `%${filters.search}%`));
      return query;
    };
    const availability = await pharmacyAvailability(db, [{id: itemId, currentStock: Number(item.current_stock), batchTracking: Boolean(item.pharmacy_batch_tracking)}], this.branch);
    const movementTotals = await movements().select(db.raw(
      "COALESCE(SUM(CASE WHEN m.transaction_type='consumption' THEN m.previous_stock-m.new_stock ELSE 0 END),0) as issued, COALESCE(SUM(CASE WHEN m.transaction_type='write_off' THEN m.previous_stock-m.new_stock ELSE 0 END),0) as wasted, COALESCE(SUM(CASE WHEN m.transaction_type='write_off' THEN ABS(m.total_cost) ELSE 0 END),0) as wasteCost"
    )).first();
    const summary = {
      physical: Number(item.current_stock), dispensable: availability.get(itemId) || 0,
      stockValue: Number((Number(item.current_stock) * Number(item.cost_price)).toFixed(2)),
      issued: Number(movementTotals.issued), wasted: Number(movementTotals.wasted), wasteCost: Number(movementTotals.wasteCost),
      dailyUsage: Number(movementTotals.issued) / filters.days,
    };
    let query: any, columns: ReturnType<typeof column>[], trend: any[] = [];
    let series = [{key: 'quantity', name: 'Units'}], note = '';
    if (section === 'orders' || section === 'supplier-performance') {
      note = 'Orders are selected by creation date. Accepted quantities show their current fulfilment.';
      const source = orderQuery();
      if (section === 'supplier-performance') {
        source.whereIn('o.status', ['approved', 'ordered', 'partially_received', 'received']);
        query = source.select('s.id', 's.name as supplier').countDistinct('o.id as orders')
          .sum('l.quantity_ordered as ordered').sum('l.quantity_received as accepted')
          .select(db.raw('CASE WHEN SUM(l.quantity_ordered)>0 THEN 100.0*SUM(l.quantity_received)/SUM(l.quantity_ordered) ELSE 0 END as fillRate'))
          .groupBy('s.id', 's.name');
        columns = [column('supplier', 'Supplier'), column('orders', 'Orders', 'number'), column('ordered', 'Ordered units', 'number'), column('accepted', 'Accepted units', 'number'), column('fillRate', 'Fulfilment %', 'number')];
        trend = await query.clone().orderBy('supplier');
      } else {
        query = source.select('l.id', 'o.id as orderId', 'w.details as orderDetails', 'o.created_at as date', 's.name as supplier', 'o.status', 'l.quantity_ordered as ordered', 'l.quantity_received as accepted', 'l.unit_cost as unitCost');
        columns = [column('reference', 'Order'), column('date', 'Created', 'date'), column('supplier', 'Supplier'), column('status', 'Status'), column('ordered', 'Ordered units', 'number'), column('accepted', 'Accepted units', 'number'), column('unitCost', 'Quoted unit cost', 'money')];
        trend = await orderQuery().whereIn('o.status', ['approved', 'ordered', 'partially_received', 'received'])
          .select(db.raw(`${periodSql('o.created_at')} as period`)).sum('l.quantity_ordered as ordered').sum('l.quantity_received as accepted')
          .groupByRaw(periodSql('o.created_at')).orderBy('period');
      }
      series = [{key: 'ordered', name: 'Ordered'}, {key: 'accepted', name: 'Accepted'}];
    } else if (section === 'movements') {
      query = scopedMovements().select('m.id', 'm.transaction_date as date', 'm.transaction_type as type', 'm.batch_number as batch', 'm.previous_stock as previous', 'm.new_stock as balance', 'm.reason', 'm.reference_id as reference')
        .select(db.raw('m.new_stock-m.previous_stock as quantity'));
      columns = [column('date', 'Date', 'date'), column('type', 'Movement'), column('batch', 'Batch'), column('quantity', 'Stock change', 'number'), column('previous', 'Before', 'number'), column('balance', 'After', 'number'), column('reason', 'Reason')];
      note = 'Stock changes are signed. Positive quantities add stock and negative quantities remove stock.';
    } else {
      const source = scopedMovements();
      if (section === 'dispensing') source.join('pharmacy_sales as sale', 'sale.id', 'm.reference_id').where('sale.branchid', this.branch).whereNotNull('sale.prescription_id');
      const wastage = section === 'wastage';
      if (section !== 'summary') source.where('m.transaction_type', wastage ? 'write_off' : 'consumption');
      query = source.select(db.raw(`${periodSql('m.transaction_date')} as period`));
      if (section === 'summary') {
        query.select(db.raw("SUM(CASE WHEN m.new_stock>m.previous_stock THEN m.new_stock-m.previous_stock ELSE 0 END) as added, SUM(CASE WHEN m.transaction_type='consumption' THEN m.previous_stock-m.new_stock ELSE 0 END) as issued, SUM(CASE WHEN m.transaction_type='write_off' THEN m.previous_stock-m.new_stock ELSE 0 END) as wasted"));
        columns = [column('period', 'Period'), column('added', 'Stock added', 'number'), column('issued', 'Gross stock issued', 'number'), column('wasted', 'Written off', 'number')];
        series = [{key: 'added', name: 'Stock added'}, {key: 'issued', name: 'Gross issues'}, {key: 'wasted', name: 'Written off'}];
        note = 'Stock balances are current. Activity follows the selected dates. Stock added includes purchases, returns and other additions.';
      } else {
        query.select(db.raw('SUM(m.previous_stock-m.new_stock) as quantity, SUM(ABS(m.total_cost)) as cost'));
        columns = [column('period', 'Period'), column('quantity', wastage ? 'Written-off units' : 'Gross issued units', 'number'), column('cost', 'Recorded stock cost', 'money')];
        note = wastage ? 'Includes posted write-offs dated within this period.' : section === 'dispensing' ? 'Gross stock issues linked to prescriptions. This reflects stock issued, including issues subsequently reversed.' : 'Gross consumption movements in the selected period. Restocked returns remain visible in Stock movements.';
      }
      query.groupByRaw(periodSql('m.transaction_date'));
      trend = await query.clone().orderBy('period');
    }
    const totalRow = await db.from(query.clone().as('item_report')).count('* as total').first();
    const total = Number(totalRow?.total || 0), totalPages = Math.max(1, Math.ceil(total / filters.count));
    const page = Math.min(filters.page, totalPages);
    const sort = section === 'orders' || section === 'movements' ? 'date' : section === 'supplier-performance' ? 'supplier' : 'period';
    const rows = await query.orderBy(sort, section === 'supplier-performance' ? 'asc' : 'desc')
      .modify((q: any) => {if (sort === 'date') q.orderBy(section === 'orders' ? 'l.id' : 'm.id');})
      .limit(filters.count).offset((page - 1) * filters.count);
    if(section==='orders')for(const row of rows){row.reference=json(row.orderDetails).reference||`PO-${row.orderId.slice(0,8).toUpperCase()}`;delete row.orderDetails;}
    const suppliers = await orders().distinct('s.id', 's.name').orderBy('s.name');
    return {item: {id: item.id, name: item.name, sku: item.sku, unit: item.consumption_unit}, summary, section, period, from: filters.from, to: filters.to,
      columns, rows, trend, series, trendLabel: section === 'supplier-performance' ? 'supplier' : 'period', note, suppliers, total, totalPages, page, count: filters.count};
  }
}
