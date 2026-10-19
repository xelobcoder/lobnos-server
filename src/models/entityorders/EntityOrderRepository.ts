import KnexConnection from '../../database/KnexConnections';
import {
     EntityOrderDecisionAction,
     EntityOrderRow,
     EntityOrderStatus,
} from './EntityOrder.types';

export interface EntityOrderListFilters {
     patientId?: number;
     entityType?: string;
     entityId?: number;
     /** Orders billed to this clinician OR placed by them (covers orders stored as 'general'). */
     clinicianId?: number;
     status?: EntityOrderStatus;
     pendingReview?: boolean;
     sampleLocation?: 'center' | 'referrer';
     consultationId?: number;
     /** Inclusive YYYY-MM-DD bounds on DATE(o.created_at). */
     from?: string;
     to?: string;
     page?: number;
     count?: number;
}

/** Applies list filters to a query rooted at `entity_orders as o`. Status is excluded so summaries can group by it. */
export function applyEntityOrderFilters(q: any, filters: Omit<EntityOrderListFilters, 'status' | 'pendingReview' | 'page' | 'count'>) {
     if (filters.patientId) q.where('o.patient_id', filters.patientId);
     if (filters.entityType) q.where('o.entity_type', filters.entityType);
     if (filters.entityId) q.where('o.entity_id', filters.entityId);
     if (filters.clinicianId) {
          const clinicianId = filters.clinicianId;
          q.where((scope: any) => {
               scope.where((own: any) => own.where('o.entity_type', 'clinician').andWhere('o.entity_id', clinicianId))
                    .orWhere('o.ordered_by_employee_id', clinicianId);
          });
     }
     if (filters.sampleLocation) q.where('o.sample_location', filters.sampleLocation);
     if (filters.consultationId) q.where('o.consultation_id', filters.consultationId);
     if (filters.from && filters.to) q.whereRaw('DATE(o.created_at) BETWEEN ? AND ?', [filters.from, filters.to]);
     else if (filters.from) q.whereRaw('DATE(o.created_at) >= ?', [filters.from]);
     else if (filters.to) q.whereRaw('DATE(o.created_at) <= ?', [filters.to]);
     return q;
}

/**
 * Data access for the entity_orders tables. All reads scoped by patient or id;
 * the service layer enforces lifecycle rules.
 */
export class EntityOrderRepository {
     private connection: any;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private baseQuery(conn: any) {
          return conn('entity_orders as o')
               .leftJoin('clinicianbasicinfo as c', function (this: any) {
                    this.on('c.id', '=', 'o.entity_id').andOn(conn.raw('?', ['clinician']), conn.raw('o.entity_type'));
               })
               .leftJoin('organization as org', function (this: any) {
                    this.on('org.id', '=', 'o.entity_id').andOn(conn.raw('?', ['organization']), conn.raw('o.entity_type'));
               })
               .leftJoin('new_patients as p', 'p.patientid', 'o.patient_id');
     }

     private mapRow(row: any) {
          return {
               ...row,
               entityName: row.entity_type === 'clinician' ? row.clinician_name
                    : row.entity_type === 'organization' ? row.organization_name
                         : 'General',
               patientName: [row.firstname, row.middlename, row.lastname].filter(Boolean).join(' ').trim() || null,
          };
     }

     async createOrder(order: Partial<EntityOrderRow>, lines: Array<Partial<any>>): Promise<number> {
          const conn = await this.connection;
          return await conn.transaction(async (trx: any) => {
               const [orderId] = await trx('entity_orders').insert({
                    patient_id: order.patient_id,
                    consultation_id: order.consultation_id ?? null,
                    ordered_by_employee_id: order.ordered_by_employee_id,
                    entity_type: order.entity_type ?? 'general',
                    entity_id: order.entity_id ?? null,
                    billing_source: order.billing_source ?? 1,
                    strategy_id: order.strategy_id ?? null,
                    status: order.status ?? 'DRAFT',
                    revision: order.revision ?? 1,
                    sample_location: (order as any).sample_location ?? 'center',
                    notes: order.notes ?? null,
                    branch_id: order.branch_id ?? null,
               });
               const lineRows = lines.map((line) => ({ ...line, order_id: orderId }));
               await trx('entity_order_lines').insert(lineRows);
               return typeof orderId === 'number' ? orderId : Number(orderId);
          });
     }

     async replaceLines(orderId: number, lines: Array<Partial<any>>, trx?: any): Promise<void> {
          const conn = trx || (await this.connection);
          await conn('entity_order_lines').where({ order_id: orderId }).del();
          const lineRows = lines.map((line) => ({ ...line, order_id: orderId }));
          if (lineRows.length) await conn('entity_order_lines').insert(lineRows);
     }

     async getOrderById(orderId: number) {
          const conn = await this.connection;
          const row = await this.baseQuery(conn)
               .select(
                    'o.*',
                    conn.raw('c.name AS clinician_name'),
                    conn.raw('org.name AS organization_name'),
                    'p.firstname', 'p.middlename', 'p.lastname'
               )
               .where('o.id', orderId)
               .first();
          if (!row) return null;
          const lines = await conn('entity_order_lines').where({ order_id: orderId }).orderBy('id', 'asc');
          const decisions = await conn('entity_order_decisions').where({ order_id: orderId }).orderBy('id', 'desc');
          return { ...this.mapRow(row), lines, decisions };
     }

     /** Order counts and line value per status for the same scope as listOrders (ignores status/page). */
     async summarizeOrders(filters: EntityOrderListFilters) {
          const conn = await this.connection;
          const rows = await applyEntityOrderFilters(conn('entity_orders as o'), filters)
               .leftJoin(
                    conn('entity_order_lines')
                         .select('order_id', conn.raw('SUM(unit_price * quantity) AS line_total'))
                         .groupBy('order_id')
                         .as('lt'),
                    'lt.order_id',
                    'o.id'
               )
               .select('o.status', conn.raw('COUNT(o.id) AS total'), conn.raw('COALESCE(SUM(lt.line_total), 0) AS value'))
               .groupBy('o.status');

          const byStatus: Record<string, { count: number; value: number }> = {};
          let total = 0;
          let value = 0;
          for (const row of rows as any[]) {
               const c = Number(row.total || 0);
               const v = parseFloat(Number(row.value || 0).toFixed(2));
               byStatus[row.status] = { count: c, value: v };
               total += c;
               value += v;
          }
          return { total, value: parseFloat(value.toFixed(2)), byStatus };
     }

     async listOrders(filters: EntityOrderListFilters) {
          const conn = await this.connection;
          const page = Math.max(1, Number(filters.page || 1));
          const count = Math.max(1, Number(filters.count || 10));

          const base = () => this.baseQuery(conn)
               .where((q: any) => {
                    applyEntityOrderFilters(q, filters);
                    if (filters.status) q.where('o.status', filters.status);
                    if (filters.pendingReview) q.whereIn('o.status', ['PENDING', 'ON_HOLD']);
               });

          const countRow = await base().count('o.id as total').first();
          const total = Number((countRow as any)?.total || 0);

          const rows = await base()
               .select(
                    'o.*',
                    conn.raw('c.name AS clinician_name'),
                    conn.raw('org.name AS organization_name'),
                    'p.firstname', 'p.middlename', 'p.lastname'
               )
               .orderBy('o.created_at', 'desc')
               .limit(count)
               .offset((page - 1) * count);

          const orderIds = rows.map((r: any) => r.id);
          const lines = orderIds.length
               ? await conn('entity_order_lines').whereIn('order_id', orderIds).orderBy('id', 'asc')
               : [];
          const linesByOrder = new Map<number, any[]>();
          for (const line of lines) {
               const arr = linesByOrder.get(line.order_id) || [];
               arr.push(line);
               linesByOrder.set(line.order_id, arr);
          }

          const result = rows.map((row: any) => {
               const orderLines = linesByOrder.get(row.id) || [];
               const lineTotal = orderLines.reduce((sum: number, l: any) => sum + Number(l.unit_price) * Number(l.quantity), 0);
               return { ...this.mapRow(row), lines: orderLines, total: parseFloat(lineTotal.toFixed(2)) };
          });

          return { result, total, page, count, totalPages: Math.max(1, Math.ceil(total / count)) };
     }

     /** Backfills orders placed before a consultation existed; only touches this patient's still-unlinked orders. */
     async linkOrdersToConsultation(orderIds: number[], patientId: number, consultationId: number): Promise<number> {
          const conn = await this.connection;
          return conn('entity_orders')
               .whereIn('id', orderIds)
               .where('patient_id', patientId)
               .whereNull('consultation_id')
               .update({ consultation_id: consultationId });
     }

     async updateOrder(orderId: number, updates: Partial<EntityOrderRow>, trx?: any): Promise<void> {
          const conn = trx || (await this.connection);
          await conn('entity_orders')
               .where({ id: orderId })
               .update({ ...updates, updated_at: conn.fn.now() });
     }

     /** Ids from `orderIds` that fall inside the clinician's scope (same rule as the clinician list filter). */
     async filterOrderIdsForClinician(orderIds: number[], clinicianId: number): Promise<number[]> {
          if (!orderIds.length) return [];
          const conn = await this.connection;
          const rows = await applyEntityOrderFilters(conn('entity_orders as o').whereIn('o.id', orderIds), { clinicianId }).select('o.id');
          return rows.map((row: any) => Number(row.id));
     }

     async getOrderRow(orderId: number, trx?: any): Promise<EntityOrderRow | null> {
          const conn = trx || (await this.connection);
          return await conn('entity_orders').where({ id: orderId }).first();
     }

     async getOrderLines(orderId: number, trx?: any) {
          const conn = trx || (await this.connection);
          return await conn('entity_order_lines').where({ order_id: orderId }).orderBy('id', 'asc');
     }

     async recordDecision(
          orderId: number,
          revision: number,
          action: EntityOrderDecisionAction,
          actorId: number,
          reason?: string | null,
          trx?: any
     ): Promise<void> {
          const conn = trx || (await this.connection);
          await conn('entity_order_decisions').insert({
               order_id: orderId,
               revision,
               action,
               reason: reason ?? null,
               actor_id: actorId,
          });
     }
}
