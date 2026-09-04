import KnexConnection from '../../database/KnexConnections';
import {
     EntityOrderDecisionAction,
     EntityOrderRow,
     EntityOrderStatus,
} from './EntityOrder.types';

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

     async listOrders(filters: {
          patientId?: number;
          entityType?: string;
          entityId?: number;
          status?: EntityOrderStatus;
          pendingReview?: boolean;
          sampleLocation?: 'center' | 'referrer';
          page?: number;
          count?: number;
     }) {
          const conn = await this.connection;
          const page = Math.max(1, Number(filters.page || 1));
          const count = Math.max(1, Number(filters.count || 10));

          const base = () => this.baseQuery(conn)
               .where((q: any) => {
                    if (filters.patientId) q.where('o.patient_id', filters.patientId);
                    if (filters.entityType) q.where('o.entity_type', filters.entityType);
                    if (filters.entityId) q.where('o.entity_id', filters.entityId);
                    if (filters.status) q.where('o.status', filters.status);
                    if (filters.pendingReview) q.whereIn('o.status', ['PENDING', 'ON_HOLD']);
                    if (filters.sampleLocation) q.where('o.sample_location', filters.sampleLocation);
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

     async updateOrder(orderId: number, updates: Partial<EntityOrderRow>, trx?: any): Promise<void> {
          const conn = trx || (await this.connection);
          await conn('entity_orders')
               .where({ id: orderId })
               .update({ ...updates, updated_at: conn.fn.now() });
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
