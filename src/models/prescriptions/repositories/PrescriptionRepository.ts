import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import {
     IPrescriptionRepository,
     PrescriptionItemFulfillmentUpdate,
     PrescriptionItemRow,
     PrescriptionListFilters,
     PrescriptionRow,
     PrescriptionStatus,
     PrescriptionSummaryRow
} from '../interfaces/IPrescriptionRepository';

export class PrescriptionRepository implements IPrescriptionRepository {
     private readonly connection: Promise<Knex>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async createPrescription(prescription: PrescriptionRow, items: PrescriptionItemRow[]): Promise<void> {
          const connection = await this.connection;
          await connection.transaction(async (trx) => {
               await trx('prescriptions').insert({
                    id: prescription.id,
                    patient_id: prescription.patientId,
                    consultation_id: prescription.consultationId,
                    clinician_id: prescription.clinicianId,
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
          const row = await connection('prescriptions').where({ id }).first();
          return row ? this.toPrescriptionRow(row) : null;
     }

     async findItemsByPrescriptionId(prescriptionId: string): Promise<PrescriptionItemRow[]> {
          const connection = await this.connection;
          const rows = await connection('prescription_items').where({ prescription_id: prescriptionId }).orderBy('created_at', 'asc');
          return rows.map((row: any) => this.toItemRow(row));
     }

     async listPrescriptions(filters: PrescriptionListFilters): Promise<{ prescriptions: PrescriptionSummaryRow[]; total: number }> {
          const connection = await this.connection;
          let query = connection('prescriptions as p')
               .leftJoin('new_patients as patient', 'patient.patientid', 'p.patient_id')
               .leftJoin('roles as clinician', 'clinician.employeeid', 'p.clinician_id')
               .select(
                    'p.*',
                    connection.raw("CONCAT(COALESCE(patient.firstname, ''), ' ', COALESCE(patient.lastname, '')) as patient_name"),
                    'clinician.username as clinician_name'
               )
               .orderBy('p.created_at', 'desc');

          if (filters.statuses?.length) query = query.whereIn('p.status', filters.statuses);
          if (filters.patientId) query = query.where('p.patient_id', filters.patientId);
          if (filters.clinicianId) query = query.where('p.clinician_id', filters.clinicianId);
          if (filters.search?.trim()) {
               const term = `%${filters.search.trim()}%`;
               query = query.where((builder) => builder
                    .where('patient.firstname', 'like', term)
                    .orWhere('patient.lastname', 'like', term));
          }

          const [rows, totalResult] = await Promise.all([
               query.clone().limit(filters.count).offset((filters.page - 1) * filters.count),
               query.clone().clearSelect().clearOrder().count('* as total').first()
          ]);

          return {
               prescriptions: rows.map((row: any) => ({ ...this.toPrescriptionRow(row), patientName: row.patient_name?.trim() || 'Unknown patient', clinicianName: row.clinician_name || 'Unknown clinician' })),
               total: Number((totalResult as any)?.total || 0)
          };
     }

     async applyFulfillment(prescriptionId: string, itemUpdates: PrescriptionItemFulfillmentUpdate[], prescriptionStatus: PrescriptionStatus, occurredAt: Date): Promise<void> {
          const connection = await this.connection;
          await connection.transaction(async (trx) => {
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
          await connection.transaction(async (trx) => {
               await trx('prescription_items').whereIn('id', itemIds).update({ status: 'referred', updated_at: occurredAt });
               await trx('prescriptions').where({ id: prescriptionId }).update({ status: prescriptionStatus, updated_at: occurredAt });
          });
     }

     private toPrescriptionRow(row: any): PrescriptionRow {
          return {
               id: row.id,
               patientId: Number(row.patient_id),
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
               saleId: row.sale_id ?? null
          };
     }
}
