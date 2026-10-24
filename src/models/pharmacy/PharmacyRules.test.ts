import { describe, expect, it } from 'vitest';
import { allocateBatches, money, saleRequestHash, validateSaleInput, pharmacyTender } from './PharmacyRules';
const valid=()=>({idempotencyKey:'checkout-12345',paymentAccountId:1,paymentMethod:'cash',lines:[{inventoryItemId:'A',quantity:1}]});
describe('pharmacy checkout rules',()=>{
     it('records cash tender and change without inflating the sale',()=>{expect(pharmacyTender(85,'cash',100)).toEqual({amountTendered:100,changeAmount:15});});
     it.each([80, NaN, Infinity, -1, 85.001, '100', undefined])('rejects insufficient or invalid tender %s',value=>{expect(()=>pharmacyTender(85,'cash',value)).toThrow('received');});
     it('allows exact noncash payments and prevents cash change on noncash',()=>{
          expect(pharmacyTender(85,'card',85).changeAmount).toBe(0);
          expect(()=>pharmacyTender(85,'mobile_money',100)).toThrow('equal');
     });
     it('rounds half cents consistently',()=>{expect(money('1.005')).toBe(1.01);});
     it.each(['unknown','bank_transfer',null])('rejects unsupported payment method %s',method=>{expect(()=>validateSaleInput({...valid(),paymentMethod:method})).toThrow('payment method');});
     it('resolves accounts on the server and requires a noncash reference',()=>{
          expect(()=>validateSaleInput({...valid(),paymentAccountId:undefined})).not.toThrow();
          expect(()=>validateSaleInput({...valid(),paymentMethod:'card'})).toThrow('reference');
          expect(()=>validateSaleInput({...valid(),paymentMethod:'card',paymentReference:'verified-123'})).not.toThrow();
     });
     it('rejects duplicate lines and invalid quantity precision',()=>{
          expect(()=>validateSaleInput({...valid(),lines:[...valid().lines,...valid().lines]})).toThrow('Duplicate');
          expect(()=>validateSaleInput({...valid(),lines:[{inventoryItemId:'A',quantity:.0001}]})).toThrow('decimal');
     });
     it('fingerprints payment details, actor and prescription but ignores line order',()=>{
          const input={...valid(),lines:[...valid().lines,{inventoryItemId:'B',quantity:2}]};
          expect(saleRequestHash(input,3)).toBe(saleRequestHash({...input,lines:[...input.lines].reverse()},3));
          expect(saleRequestHash(input,3)).not.toBe(saleRequestHash(input,4));
          expect(saleRequestHash(input,3)).not.toBe(saleRequestHash(input,3,'rx-1'));
          expect(saleRequestHash(input,3)).toBe(saleRequestHash({...input,paymentAccountId:2},3));
          expect(saleRequestHash(input,3)).not.toBe(saleRequestHash({...input,amountTendered:100},3));
     });
});
describe('pharmacy batch allocation',()=>{
     const batches=[{batchNumber:'expired',available:50,expiryDate:'2026-01-01'},{batchNumber:'later',available:10,expiryDate:'2027-01-01'},{batchNumber:'first',available:3,expiryDate:'2026-11-01'}];
     it('allocates earliest expiry first and never includes expired stock',()=>{
          expect(allocateBatches(batches,5,63,true,'2026-10-23')).toEqual([{batchNumber:'first',quantity:3,expiryDate:'2026-11-01'},{batchNumber:'later',quantity:2,expiryDate:'2027-01-01'}]);
     });
     it('rejects insufficient eligible batches even when physical stock is sufficient',()=>{expect(()=>allocateBatches(batches,14,63,true,'2026-10-23')).toThrow('unexpired');});
     it('requires expiry records when tracking is enabled',()=>{
          expect(()=>allocateBatches([{batchNumber:'unknown',available:10,expiryDate:null}],1,10,true,'2026-10-23')).toThrow('expiry');
     });
     it('does not disguise expired batches as unbatched general merchandise',()=>{
          expect(()=>allocateBatches(batches,14,63,false,'2026-10-23')).toThrow('unexpired');
          const result=allocateBatches(batches,14,64,false,'2026-10-23');
          expect(result[result.length-1]).toEqual({batchNumber:null,quantity:1,expiryDate:null});
     });
});
