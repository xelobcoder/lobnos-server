import { randomUUID } from 'crypto';
import { IPharmacySaleService } from '../../pharmacy/interfaces/IPharmacySaleService';
import {
     IPrescriptionRepository,
     PrescriptionItemFulfillmentUpdate,
     PrescriptionItemRow,
     PrescriptionRow,
     PrescriptionStatus
} from '../interfaces/IPrescriptionRepository';
import {
     CreatePrescriptionInput,
     FulfillPrescriptionInput,
     FulfillPrescriptionResult,
     IPrescriptionService,
     PrescriptionDetail,
     PrescriptionItemDetail,
     PrescriptionList,
     PrescriptionListRequest,
     ReferRemainingResult
} from '../interfaces/IPrescriptionService';

const OPEN_STATUSES: PrescriptionStatus[] = ['pending', 'partially_fulfilled'];

export class PrescriptionService implements IPrescriptionService {
     constructor(
          private readonly repository: IPrescriptionRepository,
          private readonly saleService: IPharmacySaleService
     ) { }

     async createPrescription(input: CreatePrescriptionInput, clinicianId: number): Promise<PrescriptionDetail> {
          if (!input.patientId) throw new Error('A patient is required to order drugs');
          if (!input.items?.length) throw new Error('At least one drug item is required');
          for (const item of input.items) {
               if (!item.drugName?.trim()) throw new Error('Every item requires a drug name');
               if (!Number.isFinite(item.quantityOrdered) || item.quantityOrdered <= 0) throw new Error(`${item.drugName}: quantity ordered must be positive`);
          }

          const now = new Date();
          const prescription: PrescriptionRow = {
               id: randomUUID(),
               patientId: input.patientId,
               consultationId: input.consultationId || null,
               clinicianId,
               status: 'pending',
               notes: input.notes?.trim() || null,
               createdAt: now,
               updatedAt: now
          };

          const items: PrescriptionItemRow[] = input.items.map((item) => ({
               id: randomUUID(),
               prescriptionId: prescription.id,
               inventoryItemId: item.inventoryItemId || null,
               drugName: item.drugName.trim(),
               dosageInstructions: item.dosageInstructions?.trim() || null,
               dose: item.dose?.trim() || null,
               frequency: item.frequency?.trim() || null,
               duration: item.duration?.trim() || null,
               route: item.route?.trim() || null,
               quantityOrdered: item.quantityOrdered,
               quantityDispensed: 0,
               status: 'pending',
               saleId: null
          }));

          await this.repository.createPrescription(prescription, items);
          return { ...prescription, items: items.map((item) => this.toItemDetail(item)) };
     }

     async getById(id: string): Promise<PrescriptionDetail> {
          const prescription = await this.repository.findById(id);
          if (!prescription) throw new Error('Prescription not found');
          const items = await this.repository.findItemsByPrescriptionId(id);
          return { ...prescription, items: items.map((item) => this.toItemDetail(item)) };
     }

     async list(request: PrescriptionListRequest): Promise<PrescriptionList> {
          const safePage = Math.max(1, request.page);
          const safeCount = Math.min(100, Math.max(1, request.count));
          const { prescriptions, total } = await this.repository.listPrescriptions({
               page: safePage,
               count: safeCount,
               statuses: request.statuses,
               patientId: request.patientId,
               clinicianId: request.clinicianId,
               search: request.search
          });

          return {
               prescriptions: prescriptions.map((row) => ({
                    id: row.id,
                    patientId: row.patientId,
                    patientName: row.patientName,
                    clinicianId: row.clinicianId,
                    clinicianName: row.clinicianName,
                    status: row.status,
                    createdAt: row.createdAt
               })),
               total,
               page: safePage,
               count: safeCount,
               totalPages: Math.max(1, Math.ceil(total / safeCount))
          };
     }

     async fulfill(id: string, input: FulfillPrescriptionInput, cashierId: number): Promise<FulfillPrescriptionResult> {
          const prescription = await this.repository.findById(id);
          if (!prescription) throw new Error('Prescription not found');
          if (!OPEN_STATUSES.includes(prescription.status)) throw new Error(`This prescription is already ${prescription.status} and cannot be fulfilled`);
          if (!input.lines?.length) throw new Error('At least one line is required to fulfill a prescription');

          const items = await this.repository.findItemsByPrescriptionId(id);
          const itemsById = new Map(items.map((item) => [item.id, item]));

          const saleQuantitiesByInventoryItem = new Map<string, number>();
          const requestedUpdates: Array<{ item: PrescriptionItemRow; quantityDispensed: number }> = [];

          for (const line of input.lines) {
               const item = itemsById.get(line.prescriptionItemId);
               if (!item) throw new Error(`Prescription item ${line.prescriptionItemId} was not found on this prescription`);
               if (!item.inventoryItemId) throw new Error(`${item.drugName} is not linked to a pharmacy inventory item and cannot be dispensed here`);
               if (!Number.isFinite(line.quantityDispensed) || line.quantityDispensed <= 0) throw new Error('Quantities to dispense must be positive');
               const remaining = item.quantityOrdered - item.quantityDispensed;
               if (line.quantityDispensed > remaining) throw new Error(`${item.drugName}: cannot dispense more than the ${remaining} unit(s) remaining`);

               requestedUpdates.push({ item, quantityDispensed: line.quantityDispensed });
               saleQuantitiesByInventoryItem.set(item.inventoryItemId, (saleQuantitiesByInventoryItem.get(item.inventoryItemId) || 0) + line.quantityDispensed);
          }

          const receipt = await this.saleService.completeSale({
               idempotencyKey: randomUUID(),
               customerName: input.customerName,
               patientId: prescription.patientId,
               paymentMethod: input.paymentMethod,
               paymentReference: input.paymentReference,
               lines: Array.from(saleQuantitiesByInventoryItem, ([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }))
          }, cashierId);

          const now = new Date();
          const itemUpdates: PrescriptionItemFulfillmentUpdate[] = requestedUpdates.map(({ item, quantityDispensed }) => {
               const newDispensed = item.quantityDispensed + quantityDispensed;
               return {
                    id: item.id,
                    quantityDispensed: newDispensed,
                    status: newDispensed >= item.quantityOrdered ? 'dispensed' : 'pending',
                    saleId: receipt.id
               };
          });

          const updatesById = new Map(itemUpdates.map((update) => [update.id, update]));
          const isItemResolved = (item: PrescriptionItemRow) => {
               const update = updatesById.get(item.id);
               const status = update?.status ?? item.status;
               return status === 'dispensed' || status === 'referred' || status === 'cancelled';
          };
          const prescriptionStatus: PrescriptionStatus = items.every(isItemResolved)
               ? 'fulfilled'
               : (items.some(isItemResolved) || items.some((item) => item.quantityDispensed > 0)) ? 'partially_fulfilled' : prescription.status;

          await this.repository.applyFulfillment(id, itemUpdates, prescriptionStatus, now);

          return { receipt, prescription: await this.getById(id) };
     }

     async referRemaining(id: string, actorId: number): Promise<ReferRemainingResult> {
          const prescription = await this.repository.findById(id);
          if (!prescription) throw new Error('Prescription not found');
          if (!OPEN_STATUSES.includes(prescription.status)) throw new Error(`This prescription is already ${prescription.status} and has nothing left to refer`);

          const items = await this.repository.findItemsByPrescriptionId(id);
          const outstandingItems = items.filter((item) => item.status === 'pending' && item.quantityDispensed < item.quantityOrdered);
          if (!outstandingItems.length) throw new Error('There is nothing left to refer for this prescription');

          const now = new Date();
          const hasAnyDispensed = items.some((item) => item.quantityDispensed > 0);
          const prescriptionStatus: PrescriptionStatus = hasAnyDispensed ? 'fulfilled' : 'referred';

          await this.repository.markItemsReferred(id, outstandingItems.map((item) => item.id), prescriptionStatus, now);

          return {
               prescription: await this.getById(id),
               referralSlip: {
                    prescriptionId: id,
                    patientId: prescription.patientId,
                    clinicianId: prescription.clinicianId,
                    referredAt: now,
                    items: outstandingItems.map((item) => ({
                         drugName: item.drugName,
                         dosageInstructions: item.dosageInstructions,
                         dose: item.dose,
                         frequency: item.frequency,
                         duration: item.duration,
                         route: item.route,
                         quantityRemaining: item.quantityOrdered - item.quantityDispensed
                    }))
               }
          };
     }

     private toItemDetail(item: PrescriptionItemRow): PrescriptionItemDetail {
          return {
               id: item.id,
               inventoryItemId: item.inventoryItemId,
               drugName: item.drugName,
               dosageInstructions: item.dosageInstructions,
               dose: item.dose,
               frequency: item.frequency,
               duration: item.duration,
               route: item.route,
               quantityOrdered: item.quantityOrdered,
               quantityDispensed: item.quantityDispensed,
               status: item.status,
               saleId: item.saleId
          };
     }
}
