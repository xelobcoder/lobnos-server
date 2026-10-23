import { createHash } from 'crypto';
import Decimal from 'decimal.js';

export const money = (value: Decimal.Value): number => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export const quantity = (value: number): number => new Decimal(value).toDecimalPlaces(3).toNumber();
export function validatePharmacyReceipt(item:any,receipt:any,today=new Date().toISOString().slice(0,10)):void {
     if(item.inventory_domain!=='pharmacy'||item.pharmacy_batch_tracking===false||item.pharmacy_batch_tracking===0)return;
     const expiry=String(receipt.expiry_date||'');
     if(!receipt.batch_number?.trim()||String(receipt.batch_number).length>100)throw new Error('Tracked pharmacy stock requires a manufacturer batch number');
     if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||new Date(expiry).toISOString().slice(0,10)!==expiry||expiry<today)throw new Error('Tracked pharmacy stock requires a valid unexpired expiry date');
}
export function validateSaleInput(input: any): void {
     if (typeof input?.idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey)) throw new Error('A valid idempotency key is required');
     if (!['cash', 'mobile_money', 'card'].includes(input.paymentMethod)) throw new Error('Invalid payment method');
     if (!Number.isInteger(input.paymentAccountId) || input.paymentAccountId <= 0) throw new Error('Select an authorized collection account');
     if (input.paymentMethod !== 'cash' && !String(input.paymentReference || '').trim()) throw new Error('A payment reference is required for card and mobile money');
     if (String(input.paymentReference || '').length > 128 || String(input.customerName || '').length > 255) throw new Error('Payment reference or customer name is too long');
     if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) throw new Error('A sale requires 1 to 100 lines');
     if (new Set(input.lines.map((line: any) => line.inventoryItemId)).size !== input.lines.length) throw new Error('Duplicate inventory items are not allowed');
     for (const line of input.lines) {
          if (typeof line.inventoryItemId !== 'string' || !line.inventoryItemId || !Number.isFinite(line.quantity) || line.quantity <= 0 || quantity(line.quantity) !== line.quantity) throw new Error('Sale quantities must be positive with at most 3 decimal places');
     }
}
export function saleRequestHash(input: any, actor: number, prescriptionId?: string): string {
     return createHash('sha256').update(JSON.stringify({ actor, prescriptionId: prescriptionId || null, patientId: input.patientId || null,
          customerName: input.customerName?.trim() || 'Walk-in customer', paymentMethod: input.paymentMethod,
          paymentAccountId: input.paymentAccountId, paymentReference: input.paymentReference?.trim() || null, expectedTotal:input.expectedTotal ?? null,
          lines: [...input.lines].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId)) })).digest('hex');
}
export type BatchBalance = { batchNumber: string; available: number; expiryDate: string | null };
export function allocateBatches(batches: BatchBalance[], requested: number, currentStock: number, required: boolean, today: string): Array<{ batchNumber: string | null; quantity: number; expiryDate: string | null }> {
     const allocations: Array<{ batchNumber: string | null; quantity: number; expiryDate: string | null }> = [];
     let remaining = requested;
     for (const batch of [...batches].sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999') || a.batchNumber.localeCompare(b.batchNumber))) {
          if (batch.available <= 0 || (batch.expiryDate && batch.expiryDate < today) || (required && !batch.expiryDate)) continue;
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
