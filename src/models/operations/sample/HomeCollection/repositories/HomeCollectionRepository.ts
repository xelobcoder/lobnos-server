import { Knex } from 'knex';
import KnexConnection from '../../../../../database/KnexConnections';
import {
     HomeCollectionOrderStatus,
     IHomeCollectionArea,
     IHomeCollectionChecklistItem,
     IHomeCollectionOrder,
     IHomeCollectionOrderTest,
     IHomeCollectionRepository,
     IHomeCollectionStaff,
     IOrderListFilters
} from '../interfaces/IHomeCollectionRepository';

export class HomeCollectionRepository implements IHomeCollectionRepository {
     private readonly connection: Promise<Knex>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async createArea(area: Partial<IHomeCollectionArea>): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection('home_collection_areas').insert(area);
          return id;
     }

     async listAreas(activeOnly = false): Promise<IHomeCollectionArea[]> {
          const connection = await this.connection;
          const query = connection('home_collection_areas').orderBy('area_name', 'asc');
          if (activeOnly) query.where({ is_active: true });
          return query;
     }

     async updateArea(id: number, area: Partial<IHomeCollectionArea>): Promise<number> {
          const connection = await this.connection;
          return connection('home_collection_areas').where({ id }).update(area);
     }

     async createStaff(staff: Partial<IHomeCollectionStaff>): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection('home_collection_staff').insert(staff);
          return id;
     }

     async listStaff(availableOnly = false): Promise<IHomeCollectionStaff[]> {
          const connection = await this.connection;
          const query = connection('roles as r')
               .leftJoin('home_collection_staff as hcs', 'hcs.employeeid', 'r.employeeid')
               .whereRaw('LOWER(r.role) IN (?, ?, ?)', ['scientist', 'phelobotomist', 'phlebotomist'])
               .where('r.activation', 1)
               .select(
                    connection.raw('COALESCE(hcs.id, r.employeeid) as id'),
                    'r.employeeid',
                    connection.raw("COALESCE(hcs.vehicle_number, '') as vehicle_number"),
                    connection.raw('COALESCE(hcs.is_available, 1) as is_available'),
                    'r.username as staff_name',
                    'r.mobile as staff_mobile'
               )
               .orderBy('r.username', 'asc');
          if (availableOnly) {
               query.where((builder) => builder.where('hcs.is_available', true).orWhereNull('hcs.is_available'));
          }
          return query;
     }

     async updateStaff(id: number, staff: Partial<IHomeCollectionStaff>): Promise<number> {
          const connection = await this.connection;
          return connection('home_collection_staff').where({ id }).update(staff);
     }

     async createOrderWithTests(
          order: Partial<IHomeCollectionOrder>,
          tests: Array<{ testid: number; test_name_snapshot: string; price: number }>
     ): Promise<number> {
          const connection = await this.connection;
          return connection.transaction(async (trx) => {
               const [id] = await trx('home_collection_orders').insert(order);
               if (tests.length > 0) {
                    await trx('home_collection_order_tests').insert(
                         tests.map((test) => ({ ...test, home_collection_id: id }))
                    );
               }
               return id;
          });
     }

     async getOrderTests(homeCollectionId: number): Promise<IHomeCollectionOrderTest[]> {
          const connection = await this.connection;
          return connection('home_collection_order_tests').where({ home_collection_id: homeCollectionId });
     }

     async createOrderFromBilling(
          billingid: number,
          order: Omit<Partial<IHomeCollectionOrder>, 'billingid'>
     ): Promise<number> {
          const connection = await this.connection;
          return connection.transaction(async (trx) => {
               const billedServices = await trx('dboservices as ds')
                    .join('test_panels as tp', 'tp.id', 'ds.trackId')
                    .where('ds.billingid', billingid)
                    .whereNot('ds.categoryTrackId', 5) // categoryTrackId 5 = non-test service, not a collectible test
                    .where('ds.isDeleted', 0)
                    .select('tp.id as testid', 'tp.name as test_name', 'ds.totalpayable as price');

               const [id] = await trx('home_collection_orders').insert({ ...order, billingid });
               if (billedServices.length > 0) {
                    await trx('home_collection_order_tests').insert(
                         billedServices.map((service) => ({
                              home_collection_id: id,
                              testid: service.testid,
                              test_name_snapshot: service.test_name,
                              price: service.price,
                         }))
                    );
               }
               return id;
          });
     }

     async findOrderById(id: number): Promise<IHomeCollectionOrder | undefined> {
          const connection = await this.connection;
          return connection('home_collection_orders as hco')
               .leftJoin('new_patients as p', 'p.patientid', 'hco.patientid')
               .leftJoin('roles as staff', 'staff.employeeid', 'hco.assigned_to')
               .select(
                    'hco.*',
                    connection.raw("CONCAT(COALESCE(p.firstname, ''), ' ', COALESCE(p.lastname, '')) as patient_name"),
                    'p.mobile_number as patient_mobile',
                    'staff.username as staff_name'
               )
               .where('hco.id', id)
               .first();
     }

     async listOrders(filters: IOrderListFilters): Promise<{ orders: IHomeCollectionOrder[]; total: number }> {
          const connection = await this.connection;
          let query = connection('home_collection_orders as hco')
               .leftJoin('new_patients as p', 'p.patientid', 'hco.patientid')
               .leftJoin('roles as staff', 'staff.employeeid', 'hco.assigned_to')
               .select(
                    'hco.*',
                    connection.raw("CONCAT(COALESCE(p.firstname, ''), ' ', COALESCE(p.lastname, '')) as patient_name"),
                    'p.mobile_number as patient_mobile',
                    'staff.username as staff_name'
               )
               .orderBy('hco.appointment_date', 'desc');

          if (filters.status) query = query.where('hco.status', filters.status);
          if (filters.assignedTo) query = query.where('hco.assigned_to', filters.assignedTo);
          if (filters.fromDate) query = query.where('hco.appointment_date', '>=', filters.fromDate);
          if (filters.toDate) query = query.where('hco.appointment_date', '<=', filters.toDate);
          if (filters.search?.trim()) {
               const term = `%${filters.search.trim()}%`;
               query = query.where((builder) => builder
                    .where('p.firstname', 'like', term)
                    .orWhere('p.lastname', 'like', term)
                    .orWhere('hco.patientid', 'like', term));
          }

          const [rows, totalResult] = await Promise.all([
               query.clone().limit(filters.count).offset((filters.page - 1) * filters.count),
               query.clone().clearSelect().clearOrder().count('* as total').first()
          ]);

          const orderIds = rows.map((row: IHomeCollectionOrder) => row.id);
          if (orderIds.length === 0) {
               return { orders: rows, total: Number((totalResult as any)?.total || 0) };
          }

          const tests = await connection('home_collection_order_tests')
               .whereIn('home_collection_id', orderIds)
               .orderBy('test_name_snapshot', 'asc');
          const testsByOrder = tests.reduce<Record<number, IHomeCollectionOrderTest[]>>((acc, test) => {
               const homeCollectionId = Number(test.home_collection_id);
               if (!acc[homeCollectionId]) acc[homeCollectionId] = [];
               acc[homeCollectionId].push(test);
               return acc;
          }, {});

          return {
               orders: rows.map((row: IHomeCollectionOrder) => ({ ...row, tests: testsByOrder[row.id] || [] })),
               total: Number((totalResult as any)?.total || 0)
          };
     }

     async updateOrderStatus(id: number, status: HomeCollectionOrderStatus): Promise<number> {
          const connection = await this.connection;
          return connection('home_collection_orders').where({ id }).update({ status });
     }

     async assignOrder(id: number, assignedTo: number): Promise<number> {
          const connection = await this.connection;
          return connection('home_collection_orders').where({ id }).update({ assigned_to: assignedTo, status: 'Assigned' });
     }

     async getChecklistForOrder(homeCollectionId: number): Promise<IHomeCollectionChecklistItem[]> {
          const connection = await this.connection;
          return connection('home_collection_checklist')
               .where({ home_collection_id: homeCollectionId })
               .orderBy('checklist_stage', 'asc');
     }

     async updateChecklistItem(id: number, data: Partial<IHomeCollectionChecklistItem>): Promise<number> {
          const connection = await this.connection;
          return connection('home_collection_checklist').where({ id }).update(data);
     }
}
