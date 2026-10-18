import { describe, expect, it } from 'vitest';
import { DEFAULT_RESULT_DELIVERY_MODE, resolveTestDeliveryPreference } from './resultDeliveryDefaults';

describe('resolveTestDeliveryPreference', () => {
     it('uses the preference submitted for the test', () => {
          const result = resolveTestDeliveryPreference({
               employeeid: 3,
               preferences: [{ testid: 7, requested_mode: 'WhatsApp', requested_mode_detail: '0240000000', employeeid: 9 }],
          }, 7, 1);
          expect(result).toEqual({ requested_mode: 'whatsapp', requested_mode_detail: '0240000000', updated_by_employeeid: 9 });
     });

     it('defaults to hard copy when the delivery prompt is disabled', () => {
          expect(resolveTestDeliveryPreference(undefined, 7, 4)).toEqual({
               requested_mode: DEFAULT_RESULT_DELIVERY_MODE, requested_mode_detail: null, updated_by_employeeid: 4,
          });
          expect(resolveTestDeliveryPreference(null, 7, null).requested_mode).toBe('hard copy');
     });

     it('defaults to hard copy for tests without a submitted preference', () => {
          const result = resolveTestDeliveryPreference({ employeeid: 5, preferences: [{ testid: 1, requested_mode: 'email' }] }, 2, 1);
          expect(result).toEqual({ requested_mode: 'hard copy', requested_mode_detail: null, updated_by_employeeid: 5 });
     });

     it('ignores blank modes and invalid employees', () => {
          const result = resolveTestDeliveryPreference({ preferences: [{ testid: '2', requested_mode: '  ', employeeid: 'x' }] }, 2);
          expect(result).toEqual({ requested_mode: 'hard copy', requested_mode_detail: null, updated_by_employeeid: null });
     });
});
