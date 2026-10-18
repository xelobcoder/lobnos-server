import { describe, expect, it, vi } from 'vitest';

vi.mock('./PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: vi.fn() }));

import {
     DEFAULT_PATIENT_PORTAL_SETTINGS, normalizePatientPortalSettings, validatePatientPortalSettingsUpdate,
} from './PatientPortalSettings';
import { evaluateResultRelease, isResultApproved } from './PatientPortalResultService';
import { hashInvitationToken, maskEmail, parseInvitationToken, validatePortalPassword } from './PatientPortalAccountService';
import { createRateLimiter } from '../../middleware/rateLimiter';

describe('patient portal settings', () => {
     it('defaults to a disabled, approval-gated portal when nothing is stored', () => {
          const settings = normalizePatientPortalSettings(null);
          expect(settings.portal_enabled).toBe(false);
          expect(settings.self_registration_enabled).toBe(false);
          expect(settings.result_release_policy).toBe('approved');
          expect(settings.require_payment_for_results).toBe(true);
          expect(settings).toEqual(DEFAULT_PATIENT_PORTAL_SETTINGS);
     });

     it('normalizes MySQL tinyint values and ignores invalid stored values', () => {
          const settings = normalizePatientPortalSettings({
               portal_enabled: 1, billing_enabled: 0, result_release_policy: 'anything', invitation_expiry_hours: 9999,
               appointment_request_practitioner: '7',
          });
          expect(settings.portal_enabled).toBe(true);
          expect(settings.billing_enabled).toBe(false);
          expect(settings.result_release_policy).toBe('approved');
          expect(settings.invitation_expiry_hours).toBe(72);
          expect(settings.appointment_request_practitioner).toBe(7);
     });

     it('rejects unknown keys and invalid values', () => {
          expect(() => validatePatientPortalSettingsUpdate({ is_admin: true })).toThrow();
          expect(() => validatePatientPortalSettingsUpdate({ portal_enabled: 'yes' })).toThrow();
          expect(() => validatePatientPortalSettingsUpdate({ result_release_policy: 'immediate' })).toThrow();
          expect(() => validatePatientPortalSettingsUpdate({ invitation_expiry_hours: 0 })).toThrow();
          expect(() => validatePatientPortalSettingsUpdate({ invitation_expiry_hours: 721 })).toThrow();
          expect(validatePatientPortalSettingsUpdate({ portal_enabled: 'true', result_release_policy: 'manual', invitation_expiry_hours: 24 }))
               .toEqual({ portal_enabled: true, result_release_policy: 'manual', invitation_expiry_hours: 24 });
     });
});

describe('patient result release policy', () => {
     const approved = { isapproved: 1 };
     const complete = { collectionStartDate: '2026-01-01', processingStartDate: '2026-01-01', resultEntryEnd: '2026-01-02' };
     const automatic = { result_release_policy: 'approved' as const, require_payment_for_results: true };

     it('applies the facility minimum validation count', () => {
          expect(isResultApproved(null)).toBe(false);
          expect(isResultApproved({ approvedBy: '3', minvalidation: 2 })).toBe(false);
          expect(isResultApproved({ approvedBy: '3,4', minvalidation: 2 })).toBe(true);
          expect(isResultApproved({ approvedBy: '', minvalidation: 0 })).toBe(false);
          expect(isResultApproved({ isapproved: '1' })).toBe(true);
     });

     it('never releases unfinished or unverified results', () => {
          expect(evaluateResultRelease({ collectionStartDate: '2026-01-01', approval: approved, paymentstatus: 'paid' }, automatic))
               .toEqual({ stage: 'collected', released: false, pending: 'in_progress' });
          expect(evaluateResultRelease({ ...complete, paymentstatus: 'paid' }, automatic))
               .toEqual({ stage: 'completed', released: false, pending: 'awaiting_verification' });
     });

     it('requires payment when configured', () => {
          expect(evaluateResultRelease({ ...complete, approval: approved, paymentstatus: 'partial' }, automatic).pending).toBe('awaiting_payment');
          expect(evaluateResultRelease({ ...complete, approval: approved, paymentstatus: 'partial' },
               { ...automatic, require_payment_for_results: false }).released).toBe(true);
     });

     it('requires an explicit release under the manual policy and always honours withdrawal', () => {
          const manual = { result_release_policy: 'manual' as const, require_payment_for_results: false };
          expect(evaluateResultRelease({ ...complete, approval: approved }, manual).pending).toBe('awaiting_release');
          expect(evaluateResultRelease({ ...complete, approval: approved, release: { status: 'released' } }, manual).released).toBe(true);
          expect(evaluateResultRelease({ ...complete, approval: approved, paymentstatus: 'paid', release: { status: 'withdrawn' } }, automatic))
               .toEqual({ stage: 'verified', released: false, pending: 'awaiting_release' });
     });
});

describe('patient portal credentials and tokens', () => {
     it('enforces a minimum password strength', () => {
          for (const weak of ['', 'short1', 'allletters', '12345678', 'a1'.repeat(65), undefined]) {
               expect(() => validatePortalPassword(weak)).toThrow();
          }
          expect(validatePortalPassword('Secure123')).toBe('Secure123');
     });

     it('parses only well-formed invitation tokens and stores them hashed', () => {
          const secret = 'A'.repeat(43);
          expect(parseInvitationToken(`pls20154.${secret}`)).toEqual({ organization: 'PLS20154', token: `pls20154.${secret}` });
          expect(parseInvitationToken(`PLS20154.short`)).toBeNull();
          expect(parseInvitationToken(`PLS 1.${secret}`)).toBeNull();
          expect(parseInvitationToken(`PLS20154.${secret}' OR 1=1`)).toBeNull();
          expect(parseInvitationToken(null)).toBeNull();
          expect(hashInvitationToken('abc')).toMatch(/^[a-f0-9]{64}$/);
          expect(hashInvitationToken('abc')).not.toContain('abc');
     });

     it('masks email addresses shown to staff and patients', () => {
          expect(maskEmail('kwame@example.com')).toMatch(/^k\*+@example\.com$/);
          expect(maskEmail(null)).toBeNull();
     });
});

describe('public endpoint rate limiting', () => {
     const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

     it('returns 429 after the configured number of attempts from one address', () => {
          const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
          const req = { path: '/x', ip: '10.0.0.1' } as any;
          const next = vi.fn();
          limiter(req, response() as any, next);
          limiter(req, response() as any, next);
          const blocked = response();
          limiter(req, blocked as any, next);
          expect(next).toHaveBeenCalledTimes(2);
          expect(blocked.status).toHaveBeenCalledWith(429);
          limiter({ path: '/x', ip: '10.0.0.2' } as any, response() as any, next);
          expect(next).toHaveBeenCalledTimes(3);
          limiter.reset();
          limiter(req, response() as any, next);
          expect(next).toHaveBeenCalledTimes(4);
     });
});
