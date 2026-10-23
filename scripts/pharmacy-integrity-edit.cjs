const fs = require('fs');
function edit(file, fn) { const before=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'); const after=fn(before+'\n'); if(before===after)throw Error('No edit: '+file); fs.writeFileSync(file,after); }
function sub(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,100));return s.replace(a,b);}
edit('src/models/pharmacy/PharmacyBootstrapper.ts',s=>sub(sub(s,"import KnexConnection", "import { ensurePharmacyIntegritySchema } from './PharmacyIntegritySchema';\nimport KnexConnection"),"\n}\n","\n     await ensurePharmacyIntegritySchema(connection);\n}\n"));
edit('src/models/pharmacy/interfaces/IPharmacySaleRepository.ts',s=>{
 s=sub(s,'     costPrice: number;','     costPrice: number;\n     requiresPrescription?: boolean;\n     batchTracking?: boolean;');
 s=sub(s,'     idempotencyKey: string;','     idempotencyKey: string;\n     requestHash?: string;\n     prescriptionId?: string | null;\n     heldSaleId?: string | null;\n     paymentAccountId?: number;\n     branchid?: number | null;');
 s=sub(s,'     withTransaction<T>','     collectPayment(sale: PharmacySaleRow, unitOfWork: PharmacyUnitOfWork): Promise<void>;\n     reversePayment(sale: PharmacySaleRow, actor: number, reason: string, disposition: string, unitOfWork: PharmacyUnitOfWork): Promise<void>;\n     assertReturnable(sale: PharmacySaleRow, itemId: string, unitOfWork: PharmacyUnitOfWork): Promise<void>;\n     withTransaction<T>'); return s;
});
edit('src/models/pharmacy/interfaces/IPharmacySaleService.ts',s=>{
 s="import { PharmacyUnitOfWork } from './IPharmacySaleRepository';\n"+s;
 s=sub(s,'     paymentReference?: string;','     paymentReference?: string;\n     paymentAccountId: number;');
 s=sub(s,'     completedAt: Date;','     completedAt: Date;\n     customerName?: string;\n     lines?: PharmacySaleLine[];');
 s=sub(s,'     reason: string;','     reason: string;\n     disposition: \'restock\' | \'quarantine\' | \'not_returned\';');
 s=sub(s,'completeSale(input: CreatePharmacySaleInput, cashierId: number)', 'completeSale(input: CreatePharmacySaleInput, cashierId: number, unitOfWork?: PharmacyUnitOfWork, prescriptionId?: string)'); return s;
});
edit('src/models/prescriptions/interfaces/IPrescriptionService.ts',s=>sub(sub(s,'     lines: FulfillPrescriptionLineInput[];','     idempotencyKey: string;\n     paymentAccountId: number;\n     lines: FulfillPrescriptionLineInput[];'),'     saleId: string | null;','     saleId: string | null;\n     availableStock?: number;\n     salePrice?: number;'));
edit('src/models/prescriptions/interfaces/IPrescriptionRepository.ts',s=>{
 s="import { PharmacyUnitOfWork } from '../../pharmacy/interfaces/IPharmacySaleRepository';\n"+s;
 s=sub(s,'     saleId: string | null;','     saleId: string | null;\n     availableStock?: number;\n     salePrice?: number;');
 s=sub(s,'export interface IPrescriptionRepository {','export interface IPrescriptionRepository {\n     withTransaction<T>(work: (repository: IPrescriptionRepository, trx: PharmacyUnitOfWork) => Promise<T>): Promise<T>;\n     recordDispense(saleId: string, prescriptionId: string, lines: Array<{prescriptionItemId: string; quantityDispensed: number}>): Promise<void>;\n     findFulfillment(key: string): Promise<{prescriptionId: string; saleId: string; requestHash: string} | null>;');return s;
});
edit('src/models/prescriptions/repositories/PrescriptionRepository.ts',s=>{
 s=sub(s,'constructor(tenantId: number) {\n          this.connection = KnexConnection(tenantId);','constructor(private readonly tenantId: number, private readonly trx?: Knex.Transaction) {\n          this.connection = trx ? Promise.resolve(trx) : KnexConnection(tenantId);');
 s=sub(s,'     async createPrescription(',`     async withTransaction<T>(work: (repository: IPrescriptionRepository, trx: any) => Promise<T>): Promise<T> {
          if (this.trx) return work(this, this.trx);
          const db = await this.connection;
          return db.transaction(trx => work(new PrescriptionRepository(this.tenantId, trx), trx));
     }
     private async transaction<T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
          if (this.trx) return work(this.trx);
          return (await this.connection).transaction(work);
     }
     async findFulfillment(key: string) {
          const row = await (await this.connection)('pharmacy_sales').where({idempotency_key:key}).first();
          return row ? {prescriptionId:row.prescription_id, saleId:row.id, requestHash:row.request_hash} : null;
     }
     async recordDispense(saleId: string, prescriptionId: string, lines: Array<{prescriptionItemId:string; quantityDispensed:number}>): Promise<void> {
          await (await this.connection)('pharmacy_dispenses').insert(lines.map(line=>({sale_id:saleId,prescription_id:prescriptionId,prescription_item_id:line.prescriptionItemId,quantity:line.quantityDispensed,is_reversed:false})));
     }
     async createPrescription(`);
 s=s.replaceAll('await connection.transaction(async (trx) => {','await this.transaction(async (trx) => {');
 s=sub(s,"const row = await connection('prescriptions').where({ id }).first();","const query = connection('prescriptions').where({ id });\n          if (this.trx) query.forUpdate();\n          const row = await query.first();");
 s=sub(s,"const rows = await connection('prescription_items').where({ prescription_id: prescriptionId }).orderBy('created_at', 'asc');",`const query = connection('prescription_items as pi').leftJoin('inv_inventory_items as inventory','inventory.id','pi.inventory_item_id')
               .select('pi.*','inventory.current_stock as available_stock','inventory.sale_price').where('pi.prescription_id',prescriptionId).orderBy('pi.id');
          if (this.trx) query.forUpdate();
          const rows = await query;`);
 s=sub(s,'               saleId: row.sale_id','               availableStock: Number(row.available_stock || 0),\n               salePrice: Number(row.sale_price || 0),\n               saleId: row.sale_id'); return s;
});
edit('src/models/prescriptions/services/PrescriptionService.ts',s=>{
 s="import { createHash } from 'crypto';\nimport { PharmacyUnitOfWork } from '../../pharmacy/interfaces/IPharmacySaleRepository';\n"+s;
 s=sub(s,'private readonly saleService: IPharmacySaleService','private readonly saleService: IPharmacySaleService,\n          private readonly trx?: PharmacyUnitOfWork');
 s=sub(s,'          const prescription = await this.repository.findById(id);\n          if (!prescription) throw new Error(\'Prescription not found\');\n          if (!OPEN_STATUSES.includes(prescription.status))',`          if (!this.trx) return this.repository.withTransaction((repository,trx)=>new PrescriptionService(repository,this.saleService,trx).fulfill(id,input,cashierId));
          if (!input.idempotencyKey || !/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey)) throw new Error('A valid dispensing idempotency key is required');
          if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) throw new Error('Select 1 to 100 prescription items');
          if (new Set(input.lines.map(line=>line.prescriptionItemId)).size !== input.lines.length) throw new Error('Duplicate prescription items are not allowed');
          const prescription = await this.repository.findById(id);
          if (!prescription) throw new Error('Prescription not found');
          const retry = await this.repository.findFulfillment(input.idempotencyKey);
          if (retry) {
               if (retry.prescriptionId !== id) throw new Error('Dispensing retry does not match the original prescription');
               const detail = await this.saleService.getSaleDetail(retry.saleId);
               // The normal sale path verifies the request fingerprint, even after an order has closed.
               const items = await this.repository.findItemsByPrescriptionId(id);
               const totals = new Map<string,number>();
               for (const line of input.lines) { const item=items.find(item=>item.id===line.prescriptionItemId); if(!item?.inventoryItemId)throw new Error('Dispensing retry does not match'); totals.set(item.inventoryItemId,(totals.get(item.inventoryItemId)||0)+line.quantityDispensed); }
               const receipt=await this.saleService.completeSale({idempotencyKey:input.idempotencyKey,patientId:prescription.patientId,customerName:input.customerName,paymentMethod:input.paymentMethod,paymentReference:input.paymentReference,paymentAccountId:input.paymentAccountId,lines:Array.from(totals,([inventoryItemId,quantity])=>({inventoryItemId,quantity}))},cashierId,this.trx,id);
               return {receipt,prescription:await this.getById(id)};
          }
          if (!OPEN_STATUSES.includes(prescription.status))`);
 s=sub(s,"               if (!item.inventoryItemId)","               if (item.status !== 'pending') throw new Error('Only pending prescription items can be dispensed');\n               if (!item.inventoryItemId)");
 s=sub(s,'               idempotencyKey: randomUUID(),','               idempotencyKey: input.idempotencyKey,\n               paymentAccountId: input.paymentAccountId,');
 s=sub(s,'          }, cashierId);','          }, cashierId, this.trx, id);');
 s=sub(s,'items.some((item) => item.quantityDispensed > 0)','items.some((item) => (updatesById.get(item.id)?.quantityDispensed ?? item.quantityDispensed) > 0)');
 s=sub(s,'          await this.repository.applyFulfillment(id, itemUpdates, prescriptionStatus, now);','          await this.repository.applyFulfillment(id, itemUpdates, prescriptionStatus, now);\n          await this.repository.recordDispense(receipt.id, id, input.lines);');
 s=sub(s,'     async referRemaining(id: string, actorId: number): Promise<ReferRemainingResult> {','     async referRemaining(id: string, actorId: number): Promise<ReferRemainingResult> {\n          if (!this.trx) return this.repository.withTransaction((repository,trx)=>new PrescriptionService(repository,this.saleService,trx).referRemaining(id,actorId));');
 s=sub(s,'               saleId: item.saleId','               availableStock: item.availableStock,\n               salePrice: item.salePrice,\n               saleId: item.saleId');
 return s.replace("import { createHash } from 'crypto';\n",'').replace('               const detail = await this.saleService.getSaleDetail(retry.saleId);\n','');
});
