import { describe, expect, it } from 'vitest';
import { normalizeQuickReferralEntity } from './quickReferralEntity';

describe('normalizeQuickReferralEntity', () => {
     it('accepts a name only and leaves contact details empty', () => {
          expect(normalizeQuickReferralEntity('organization', { name: '  Korle   Bu  Clinic ' }))
               .toEqual({ value: { name: 'Korle Bu Clinic', phone: null, email: null }, error: null });
     });

     it('requires a name', () => {
          expect(normalizeQuickReferralEntity('clinician', { name: '   ', phone: '0241234567' }).error).toBeTruthy();
     });

     it('normalizes optional phone and email when provided', () => {
          expect(normalizeQuickReferralEntity('clinician', { name: 'Dr Mensah', phone: '024 123-4567', email: ' DR@Clinic.com ' }))
               .toEqual({ value: { name: 'Dr Mensah', phone: '0241234567', email: 'dr@clinic.com' }, error: null });
     });

     it('rejects invalid optional contact details instead of storing them', () => {
          expect(normalizeQuickReferralEntity('organization', { name: 'A', phone: '12345' }).error).toBeTruthy();
          expect(normalizeQuickReferralEntity('organization', { name: 'A', email: 'not-an-email' }).error).toBeTruthy();
     });
});
