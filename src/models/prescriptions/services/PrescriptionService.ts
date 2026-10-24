import { PharmacyUnitOfWork } from '../../pharmacy/interfaces/IPharmacySaleRepository';
import { quantity } from '../../pharmacy/PharmacyRules';
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
     PrescriptionStatusSummary,
     ReferRemainingResult
} from '../interfaces/IPrescriptionService';

const OPEN_STATUSES: PrescriptionStatus[] = ['pending', 'partially_fulfilled'];

export class PrescriptionService implements IPrescriptionService {
     constructor(
          private readonly repository: IPrescriptionRepository,
          private readonly saleService: IPharmacySaleService,
          private readonly trx?: PharmacyUnitOfWork
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

     async summarize(request: Omit<PrescriptionListRequest, 'page' | 'count' | 'statuses'>): Promise<PrescriptionStatusSummary> {
          const byStatus = await this.repository.countPrescriptionsByStatus(request);
          const total = Object.values(byStatus).reduce((sum, value) => sum + Number(value || 0), 0);
          return { total, byStatus };
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
               consultationId: request.consultationId,
               search: request.search,
               from: request.from,
               to: request.to
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

     async linkToConsultation(prescriptionIds: string[], patientId: number, consultationId: number): Promise<number> {
          return this.repository.linkPrescriptionsToConsultation(prescriptionIds, patientId, consultationId);
     }

     async fulfill(id: string, input: FulfillPrescriptionInput, cashierId: number): Promise<FulfillPrescriptionResult> {
          if (!this.trx) return this.repository.withTransaction((repository,trx)=>new PrescriptionService(repository,this.saleService,trx).fulfill(id,input,cashierId));
          if (!input.idempotencyKey || !/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey)) throw new Error('A valid dispensing idempotency key is required');
          if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) throw new Error('Select 1 to 100 prescription items');
          if (new Set(input.lines.map(line=>line.prescriptionItemId)).size !== input.lines.length) throw new Error('Duplicate prescription items are not allowed');
          const prescription = await this.repository.findById(id);
          if (!prescription) throw new Error('Prescription not found');
          const retry = await this.repository.findFulfillment(input.idempotencyKey);
          if (retry) {
               if (retry.prescriptionId !== id) throw new Error('Dispensing retry does not match the original prescription');
               const canonical=(lines: typeof input.lines)=>JSON.stringify([...lines].sort((a,b)=>a.prescriptionItemId.localeCompare(b.prescriptionItemId)));
               if(canonical(retry.lines)!==canonical(input.lines))throw new Error('Dispensing retry quantities do not match the original request');
               // The normal sale path verifies the request fingerprint, even after an order has closed.
               const items = await this.repository.findItemsByPrescriptionId(id);
               const totals = new Map<string,number>();
               for (const line of input.lines) { const item=items.find(item=>item.id===line.prescriptionItemId); if(!item?.inventoryItemId)throw new Error('Dispensing retry does not match'); totals.set(item.inventoryItemId,(totals.get(item.inventoryItemId)||0)+line.quantityDispensed); }
               const receipt=await this.saleService.completeSale({idempotencyKey:input.idempotencyKey,patientId:prescription.patientId,customerName:input.customerName,paymentMethod:input.paymentMethod,paymentReference:input.paymentReference,paymentAccountId:input.paymentAccountId,amountTendered:input.amountTendered,expectedTotal:input.expectedTotal,lines:Array.from(totals,([inventoryItemId,quantity])=>({inventoryItemId,quantity}))},cashierId,this.trx,id);
               return {receipt,prescription:await this.getById(id)};
          }
          if (!OPEN_STATUSES.includes(prescription.status)) throw new Error(`This prescription is already ${prescription.status} and cannot be fulfilled`);
          if (!input.lines?.length) throw new Error('At least one line is required to fulfill a prescription');

          const items = await this.repository.findItemsByPrescriptionId(id);
          const itemsById = new Map(items.map((item) => [item.id, item]));

          const saleQuantitiesByInventoryItem = new Map<string, number>();
          const requestedUpdates: Array<{ item: PrescriptionItemRow; quantityDispensed: number }> = [];

          for (const line of input.lines) {
               const item = itemsById.get(line.prescriptionItemId);
               if (!item) throw new Error(`Prescription item ${line.prescriptionItemId} was not found on this prescription`);
               if (item.status !== 'pending') throw new Error('Only pending prescription items can be dispensed');
               if (!item.inventoryItemId) throw new Error(`${item.drugName} is not linked to a pharmacy inventory item and cannot be dispensed here`);
               if (!Number.isFinite(line.quantityDispensed) || line.quantityDispensed <= 0 || quantity(line.quantityDispensed)!==line.quantityDispensed) throw new Error('Quantities to dispense must be positive with at most 3 decimal places');
               const remaining = quantity(item.quantityOrdered - item.quantityDispensed);
               if (line.quantityDispensed > remaining) throw new Error(`${item.drugName}: cannot dispense more than the ${remaining} unit(s) remaining`);

               requestedUpdates.push({ item, quantityDispensed: line.quantityDispensed });
               saleQuantitiesByInventoryItem.set(item.inventoryItemId, quantity((saleQuantitiesByInventoryItem.get(item.inventoryItemId) || 0) + line.quantityDispensed));
          }

          await this.repository.assertClinicalReview(id);
          const receipt = await this.saleService.completeSale({
               idempotencyKey: input.idempotencyKey,
               paymentAccountId: input.paymentAccountId,
               amountTendered: input.amountTendered,
               expectedTotal: input.expectedTotal,
               customerName: input.customerName,
               patientId: prescription.patientId,
               paymentMethod: input.paymentMethod,
               paymentReference: input.paymentReference,
               lines: Array.from(saleQuantitiesByInventoryItem, ([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }))
          }, cashierId, this.trx, id);

          const now = new Date();
          const itemUpdates: PrescriptionItemFulfillmentUpdate[] = requestedUpdates.map(({ item, quantityDispensed }) => {
               const newDispensed = quantity(item.quantityDispensed + quantityDispensed);
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
               : (items.some(isItemResolved) || items.some((item) => (updatesById.get(item.id)?.quantityDispensed ?? item.quantityDispensed) > 0)) ? 'partially_fulfilled' : prescription.status;

          await this.repository.applyFulfillment(id, itemUpdates, prescriptionStatus, now);
          await this.repository.recordDispense(receipt.id, id, input.lines);

          return { receipt, prescription: await this.getById(id) };
     }

     async referRemaining(id: string, actorId: number): Promise<ReferRemainingResult> {
          if (!this.trx) return this.repository.withTransaction((repository,trx)=>new PrescriptionService(repository,this.saleService,trx).referRemaining(id,actorId));
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
               availableStock: item.availableStock,
               salePrice: item.salePrice,
               saleId: item.saleId
          };
     }
}

