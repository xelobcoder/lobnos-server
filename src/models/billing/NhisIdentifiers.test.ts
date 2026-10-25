import { describe, expect, it } from 'vitest';
import { nhisIdentifiers } from './NhisIdentifiers';
describe('NHIS identifiers', () => {
    it('preserves long strings and leading zeroes exactly', () => {
        expect(nhisIdentifiers.parse({ nhismembershipid: '000123456789012345678901234567890', claimscheckcode: '005432' }))
            .toEqual({ nhismembershipid: '000123456789012345678901234567890', claimscheckcode: '005432' });
    });
    it('accepts safely represented legacy numeric payloads', () => {
        expect(nhisIdentifiers.parse({ nhismembershipid: 12345678901234, claimscheckcode: 5432 }))
            .toEqual({ nhismembershipid: '12345678901234', claimscheckcode: '5432' });
    });
    it.each([Number.MAX_SAFE_INTEGER + 1, Infinity, 12.3, '', '1e9', '12x', '0', '1'.repeat(65)])('rejects invalid or already imprecise input %s', value => {
        expect(nhisIdentifiers.safeParse({ nhismembershipid: value, claimscheckcode: '005432' }).success).toBe(false);
    });
});
