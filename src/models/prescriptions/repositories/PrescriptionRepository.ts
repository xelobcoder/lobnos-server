import { Knex } from 'knex';
import { pharmacyAvailability } from '../../pharmacy/PharmacyAvailability';
import {assertPrescriptionClinicallyReviewed} from '../../pharmacy/PharmacyClinical';
import KnexConnection from '../../../database/KnexConnections';
import {
     IPrescriptionRepository,
     PrescriptionItemFulfillmentUpdate,
     PrescriptionItemRow,
     PrescriptionListFilters,
     PrescriptionRow,
     PrescriptionStatus,
     PrescriptionStatusCounts,
     PrescriptionSummaryRow
} from '../interfaces/IPrescriptionRepository';

/** Shared scope filters for queries rooted at `prescriptions as p` joined to `new_patients as patient`. */
export function applyPrescriptionScopeFilters<T extends Knex.QueryBuilder>(query: T, filters: Omit<PrescriptionListFilters, 'page' | 'count' | 'statuses'>): T {
     let q: any = query;
     if (filters.patientId) q = q.where('p.patient_id', filters.patientId);
     if (filters.clinicianId) q = q.where(function(this:any){this.where({'p.prescriber_type':'practitioner','p.clinician_id':filters.clinicianId}).orWhereRaw("(p.prescriber_type = 'legacy' AND EXISTS (SELECT 1 FROM medicalrecords mr JOIN practitioner_access pa ON pa.clinicianid = ? WHERE mr.id = p.consultation_id AND mr.deleted_at IS NULL AND ((mr.author_type = 'clinician' AND mr.consulationby = pa.clinicianid) OR (mr.author_type = 'staff' AND mr.consulationby = pa.staff_employeeid))))",[filters.clinicianId]);});
     if (filters.consultationId) q = q.where('p.consultation_id', filters.consultationId);
     if (filters.from && filters.to) q = q.whereRaw('DATE(p.created_at) BETWEEN ? AND ?', [filters.from, filters.to]);
     else if (filters.from) q = q.whereRaw('DATE(p.created_at) >= ?', [filters.from]);
     else if (filters.to) q = q.whereRaw('DATE(p.created_at) <= ?', [filters.to]);
     if (filters.search?.trim()) {
          const term = `%${filters.search.trim()}%`;
          q = q.where((builder: Knex.QueryBuilder) => builder
               .where('patient.firstname', 'like', term)
               .orWhere('patient.lastname', 'like', term));
     }
     return q;
}

export class PrescriptionRepository implements IPrescriptionRepository {
     private readonly connection: Promise<Knex>;

     constructor(private readonly tenantId: number, private readonly trx?: Knex.Transaction,private readonly branchId?:number|null) {
          this.connection = trx ? Promise.resolve(trx) : KnexConnection(tenantId);
     }

     async withTransaction<T>(work: (repository: IPrescriptionRepository, trx: any) => Promise<T>): Promise<T> {
          if (this.trx) return work(this, this.trx);
          const db = await this.connection;
          for(let attempt=0;;attempt++) {
               try { return await db.transaction(trx => work(new PrescriptionRepository(this.tenantId, trx,this.branchId), trx)); }
               catch(error:any) { if(attempt>=2 || !['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code))throw error; }
          }
     }
     async assertClinicalReview(id:string){if(!this.branchId)throw new Error('Select an operating branch');await assertPrescriptionClinicallyReviewed(await this.connection,this.branchId,id);}
     private async transaction<T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
          if (this.trx) return work(this.trx);
          return (await this.connection).transaction(work);
     }
     async findFulfillment(key: string) {
          const row = await (await this.connection)('pharmacy_sales').where({idempotency_key:key}).first();
          if(!row)return null;
          const lines=await (await this.connection)('pharmacy_dispenses').where({sale_id:row.id});
          return {prescriptionId:row.prescription_id, saleId:row.id, requestHash:row.request_hash,lines:lines.map((line:any)=>({prescriptionItemId:String(line.prescription_item_id),quantityDispensed:Number(line.quantity)}))};
     }
     async recordDispense(saleId: string, prescriptionId: string, lines: Array<{prescriptionItemId:string; quantityDispensed:number}>): Promise<void> {
          await (await this.connection)('pharmacy_dispenses').insert(lines.map(line=>({sale_id:saleId,prescription_id:prescriptionId,prescription_item_id:line.prescriptionItemId,quantity:line.quantityDispensed,is_reversed:false})));
     }
     async createPrescription(prescription: PrescriptionRow, items: PrescriptionItemRow[]): Promise<void> {
          const connection = await this.connection;
          await this.transaction(async (trx) => {
               await trx('prescriptions').insert({
                    id: prescription.id,
                    request_key: prescription.requestKey || null,
                    patient_id: prescription.patientId,
                    consultation_id: prescription.consultationId,
                    clinician_id: prescription.clinicianId,
                    prescriber_type: 'practitioner',
                    status: prescription.status,
                    notes: prescription.notes,
                    created_at: prescription.createdAt,
                    updated_at: prescription.updatedAt
               });

               await trx('prescription_items').insert(items.map((item) => ({
                    id: item.id,
                    prescription_id: item.prescriptionId,
                    inventory_item_id: item.inventoryItemId,
                    drug_name_snapshot: item.drugName,
                    dosage_instructions: item.dosageInstructions,
                    dose: item.dose,
                    frequency: item.frequency,
                    duration: item.duration,
                    route: item.route,
                    quantity_ordered: item.quantityOrdered,
                    quantity_dispensed: item.quantityDispensed,
                    status: item.status,
                    sale_id: item.saleId,
                    created_at: prescription.createdAt,
                    updated_at: prescription.createdAt
               })));
          });
     }

     async findById(id: string): Promise<PrescriptionRow | null> {
          const connection = await this.connection;
          const query = connection('prescriptions').where({ id });
          if (this.trx) query.forUpdate();
          const row = await query.first();
          if(row) {
               const patient=await connection('new_patients').select('firstname','lastname').where({patientid:row.patient_id}).first();
               row.patient_name=patient ? `${patient.firstname || ''} ${patient.lastname || ''}`.trim() : 'Unknown patient';
          }
          return row ? this.toPrescriptionRow(row) : null;
     }

     async findItemsByPrescriptionId(prescriptionId: string): Promise<PrescriptionItemRow[]> {
          const connection = await this.connection;
          const query = connection('prescription_items as pi').leftJoin('pharmacy_inventory_items as inventory','inventory.id','pi.inventory_item_id')
               .select('pi.*','inventory.current_stock as available_stock','inventory.sale_price','inventory.pharmacy_batch_tracking').where('pi.prescription_id',prescriptionId).orderBy('pi.id');
          if (this.trx) query.forUpdate();
          const rows = await query;
          const availability=await pharmacyAvailability(connection,rows.filter((row:any)=>row.inventory_item_id).map((row:any)=>({id:row.inventory_item_id,currentStock:Number(row.available_stock),batchTracking:Boolean(row.pharmacy_batch_tracking)})));
          rows.forEach((row:any)=>{row.available_stock=availability.get(row.inventory_item_id)||0;});
          return rows.map((row: any) => this.toItemRow(row));
     }

     async listPrescriptions(filters: PrescriptionListFilters): Promise<{ prescriptions: PrescriptionSummaryRow[]; total: number }> {
          const connection = await this.connection;
          let query = connection('prescriptions as p')
               .leftJoin('new_patients as patient', 'patient.patientid', 'p.patient_id')
               .leftJoin('clinicianbasicinfo as clinician', 'clinician.id', 'p.clinician_id')
               .select(
                    'p.*',
                    connection.raw("CONCAT(COALESCE(patient.firstname, ''), ' ', COALESCE(patient.lastname, '')) as patient_name"),
                    connection.raw("CASE WHEN p.prescriber_type='practitioner' THEN clinician.name ELSE 'Historical prescriber (verification required)' END as clinician_name")
               )
               .orderBy('p.created_at', 'desc');

          if (filters.statuses?.length) query = query.whereIn('p.status', filters.statuses);
          query = applyPrescriptionScopeFilters(query, filters);

          const [rows, totalResult] = await Promise.all([
               query.clone().limit(filters.count).offset((filters.page - 1) * filters.count),
               query.clone().clearSelect().clearOrder().count('* as total').first()
          ]);

          return {
               prescriptions: rows.map((row: any) => ({ ...this.toPrescriptionRow(row), patientName: row.patient_name?.trim() || 'Unknown patient', clinicianName: row.clinician_name || 'Unknown clinician' })),
               total: Number((totalResult as any)?.total || 0)
          };
     }

     async countPrescriptionsByStatus(filters: Omit<PrescriptionListFilters, 'page' | 'count' | 'statuses'>): Promise<PrescriptionStatusCounts> {
          const connection = await this.connection;
          const query = applyPrescriptionScopeFilters(
               connection('prescriptions as p').leftJoin('new_patients as patient', 'patient.patientid', 'p.patient_id'),
               filters
          )
               .select('p.status', connection.raw('COUNT(*) AS total'))
               .groupBy('p.status');
          const rows: any[] = await query;
          const counts: PrescriptionStatusCounts = {};
          for (const row of rows) counts[row.status as PrescriptionStatus] = Number(row.total || 0);
          return counts;
     }

     async linkPrescriptionsToConsultation(prescriptionIds: string[], patientId: number, consultationId: number): Promise<number> {
          const connection = await this.connection;
          return connection('prescriptions')
               .whereIn('id', prescriptionIds)
               .where('patient_id', patientId)
               .whereNull('consultation_id')
               .update({ consultation_id: consultationId });
     }

     async applyFulfillment(prescriptionId: string, itemUpdates: PrescriptionItemFulfillmentUpdate[], prescriptionStatus: PrescriptionStatus, occurredAt: Date): Promise<void> {
          const connection = await this.connection;
          await this.transaction(async (trx) => {
               for (const update of itemUpdates) {
                    await trx('prescription_items').where({ id: update.id }).update({
                         quantity_dispensed: update.quantityDispensed,
                         status: update.status,
                         sale_id: update.saleId,
                         updated_at: occurredAt
                    });
               }
               await trx('prescriptions').where({ id: prescriptionId }).update({ status: prescriptionStatus, updated_at: occurredAt });
          });
     }

     async markItemsReferred(prescriptionId: string, itemIds: string[], prescriptionStatus: PrescriptionStatus, occurredAt: Date): Promise<void> {
          const connection = await this.connection;
          await this.transaction(async (trx) => {
               await trx('prescription_items').whereIn('id', itemIds).update({ status: 'referred', updated_at: occurredAt });
               await trx('prescriptions').where({ id: prescriptionId }).update({ status: prescriptionStatus, updated_at: occurredAt });
          });
     }

     private toPrescriptionRow(row: any): PrescriptionRow {
          return {
               id: row.id,
               patientId: Number(row.patient_id),
               patientName: row.patient_name,
               consultationId: row.consultation_id ?? null,
               clinicianId: Number(row.clinician_id),
               status: row.status,
               notes: row.notes ?? null,
               createdAt: row.created_at,
               updatedAt: row.updated_at
          };
     }

     private toItemRow(row: any): PrescriptionItemRow {
          return {
               id: row.id,
               prescriptionId: row.prescription_id,
               inventoryItemId: row.inventory_item_id ?? null,
               drugName: row.drug_name_snapshot,
               dosageInstructions: row.dosage_instructions ?? null,
               dose: row.dose ?? null,
               frequency: row.frequency ?? null,
               duration: row.duration ?? null,
               route: row.route ?? null,
               quantityOrdered: Number(row.quantity_ordered),
               quantityDispensed: Number(row.quantity_dispensed),
               status: row.status,
               availableStock: Number(row.available_stock || 0),
               salePrice: Number(row.sale_price || 0),
               saleId: row.sale_id ?? null
          };
     }
}

