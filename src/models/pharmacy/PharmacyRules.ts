import { createHash } from 'crypto';
import Decimal from 'decimal.js';

export const money = (value: Decimal.Value): number => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export const quantity = (value: number): number => new Decimal(value).toDecimalPlaces(3).toNumber();
export function pharmacyReceivingUnits(item: any, input: any): { baseQuantity: number; baseUnitCost: number; total: number; factor: number; receivingUnit: string } {
     if (!['consumption', 'purchase', undefined].includes(input.unit_type)) throw new Error('Choose individual units or purchase packs');
     const packs = input.unit_type === 'purchase';
     const factor = packs ? Number(item.units_per_purchase_unit || 0) : 1;
     if (!Number.isFinite(factor) || factor <= 0 || quantity(factor) !== factor || (packs && !item.purchase_unit)) throw new Error('Configure the purchase pack and units per pack for this medicine first');
     if (input.units_per_purchase_unit !== undefined && Number(input.units_per_purchase_unit) !== factor) throw new Error('The pack size changed. Reload this medicine before receiving stock');
     const units = new Decimal(input.quantity).mul(factor);
     if (!units.isFinite() || units.lte(0) || units.gt('99999999999.999') || !units.eq(units.toDecimalPlaces(3))) throw new Error('The converted stock quantity must be positive with at most three decimal places');
     return { baseQuantity: units.toNumber(), baseUnitCost: new Decimal(input.unit_price).div(factor).toDecimalPlaces(6).toNumber(), total: money(new Decimal(input.quantity).mul(input.unit_price)), factor, receivingUnit: String(packs ? item.purchase_unit : item.consumption_unit || 'unit') };
}
export function pharmacyTender(total: number, method: string, received: unknown): { amountTendered: number; changeAmount: number } {
     if (typeof received !== 'number' || !Number.isFinite(received) || received < total || received > 999999999999.99 || money(received) !== received) throw new Error('Amount received must cover the sale total and have at most two decimal places');
     if (method !== 'cash' && received !== total) throw new Error('Card and mobile money receipts must equal the sale total');
     return { amountTendered: received, changeAmount: money(new Decimal(received).minus(total)) };
}
export function validatePharmacyReceipt(item:any,receipt:any,today=new Date().toISOString().slice(0,10)):void {
     if(item.inventory_domain!=='pharmacy'||item.pharmacy_batch_tracking===false||item.pharmacy_batch_tracking===0)return;
     const expiry=String(receipt.expiry_date||'');
     if(!receipt.batch_number?.trim()||String(receipt.batch_number).length>100)throw new Error('Tracked pharmacy stock requires a manufacturer batch number');
     if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||new Date(expiry).toISOString().slice(0,10)!==expiry||expiry<today)throw new Error('Tracked pharmacy stock requires a valid unexpired expiry date');
}
export function pharmacyUnitPrice(item:{salePrice:number;wholesalePrice?:number},type:unknown='retail'):number {
     if(!['retail','wholesale'].includes(String(type)))throw new Error('Choose retail or wholesale pricing');
     const price=type==='wholesale'?Number(item.wholesalePrice):Number(item.salePrice);
     if(!Number.isFinite(price)||price<=0)throw new Error('This item has no active '+type+' price. Configure its price before selling');
     return price;
}
export function validateSaleInput(input: any): void {
     pharmacyTransactionPriceType(input);
     if (typeof input?.idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey)) throw new Error('A valid idempotency key is required');
     if (!['cash', 'mobile_money', 'card','split','credit'].includes(input.paymentMethod)) throw new Error('Invalid payment method');
     if(!['split','credit'].includes(input.paymentMethod)&&(input.tenders!==undefined||input.customerAccountId!==undefined))throw new Error('Split tenders and customer accounts require split or credit payment mode');
     if (input.amountTendered !== undefined && (typeof input.amountTendered !== 'number' || !Number.isFinite(input.amountTendered) || input.amountTendered < 0 || money(input.amountTendered) !== input.amountTendered)) throw new Error('Enter a valid amount received with at most two decimal places');
     if (['card','mobile_money'].includes(input.paymentMethod) && !String(input.paymentReference || '').trim()) throw new Error('A payment reference is required for card and mobile money');
     if (String(input.paymentReference || '').length > 128 || String(input.customerName || '').length > 255) throw new Error('Payment reference or customer name is too long');
     if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) throw new Error('A sale requires 1 to 100 lines');
     if (new Set(input.lines.map((line: any) => line.inventoryItemId)).size !== input.lines.length) throw new Error('Duplicate inventory items are not allowed');
     for (const line of input.lines) {
          if(line.priceType!==undefined&&!['retail','wholesale'].includes(line.priceType))throw new Error('Choose retail or wholesale pricing');
          if (typeof line.inventoryItemId !== 'string' || !line.inventoryItemId || !Number.isFinite(line.quantity) || line.quantity <= 0 || quantity(line.quantity) !== line.quantity) throw new Error('Sale quantities must be positive with at most 3 decimal places');
     }
}
export function pharmacyTransactionPriceType(input:any):'retail'|'wholesale' {
     const type=input.priceType??input.lines?.[0]?.priceType??'retail';
     if(!['retail','wholesale'].includes(type)||input.lines?.some((line:any)=>(line.priceType??type)!==type))throw new Error('Use one retail or wholesale price type for the whole transaction');
     return type;
}
export function saleRequestHash(input: any, actor: number, prescriptionId?: string): string {
     return createHash('sha256').update(JSON.stringify({ actor, prescriptionId: prescriptionId || null, patientId: input.patientId || null,
          customerName: input.customerName?.trim() || 'Walk-in customer', paymentMethod: input.paymentMethod,
          amountTendered: input.amountTendered ?? null, paymentReference: input.paymentReference?.trim() || null, expectedTotal:input.expectedTotal ?? null,
          ...(input.priceType!==undefined?{priceType:input.priceType}:{}),...(input.tenders!==undefined?{tenders:input.tenders}:{}),...(input.customerAccountId!==undefined?{customerAccountId:input.customerAccountId}:{}),lines: [...input.lines].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId)) })).digest('hex');
}
export type BatchBalance = { batchNumber: string; available: number; expiryDate: string | null; blocked?:boolean };
export function allocateBatches(batches: BatchBalance[], requested: number, currentStock: number, required: boolean, today: string): Array<{ batchNumber: string | null; quantity: number; expiryDate: string | null }> {
     const allocations: Array<{ batchNumber: string | null; quantity: number; expiryDate: string | null }> = [];
     let remaining = requested;
     for (const batch of [...batches].sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999') || a.batchNumber.localeCompare(b.batchNumber))) {
          if (batch.blocked || batch.available <= 0 || (batch.expiryDate && batch.expiryDate < today) || (required && !batch.expiryDate)) continue;
          const take = quantity(Math.min(remaining, batch.available));
          if (take > 0) allocations.push({ batchNumber: batch.batchNumber, quantity: take, expiryDate: batch.expiryDate });
          remaining = quantity(remaining - take); if (!remaining) break;
     }
     if (remaining > 0 && !required) {
          const unbatched = quantity(Math.max(0, currentStock - batches.reduce((sum, batch) => sum + Math.max(0, batch.available), 0)));
          const take = Math.min(remaining, unbatched);
          if (take > 0) allocations.push({ batchNumber: null, quantity: take, expiryDate: null });
          remaining = quantity(remaining - take);
     }
     if (remaining > 0) throw new Error('Insufficient unexpired stock with valid batch and expiry records; receive or reconcile stock before dispensing');
     return allocations;
}
