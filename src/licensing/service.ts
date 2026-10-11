import { certificatePeriod, keyFingerprint, LicenseError, tenantId, verifyCertificate } from './certificate';
import { issuerPublicKey, licenseMode, LicenseStorage, LicenseState } from './storage';

const ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;
export function observeClock(state: LicenseState, now: number): void {
     if (!Number.isSafeInteger(now) || now < 0) throw new LicenseError('LICENSE_CLOCK_INVALID', 503);
     if (now + ROLLBACK_TOLERANCE_MS < state.lastSeenAt) throw new LicenseError('LICENSE_CLOCK_ROLLBACK');
     state.lastSeenAt = Math.max(state.lastSeenAt, now);
}
export type SignedLicenseState = 'legacy' | 'missing' | 'active' | 'grace' | 'not_started' | 'expired' | 'invalid';
export interface SignedLicenseStatus {
     mode: 'legacy' | 'signed';
     state: SignedLicenseState;
     signedValid: boolean | null;
     reason?: string;
     licenseId?: string;
     startsAt?: string;
     endsAt?: string;
     graceDays?: number;
}
export class OfflineLicenseService {
     constructor(private storage?: LicenseStorage, private now = Date.now, private key = issuerPublicKey) {}
     private store() { return this.storage || new LicenseStorage(); }

     async request(id: number) {
          tenantId(id);
          return this.store().update(state => ({
               version: 1, tenantId: id, installationId: state.identity.installationId,
               installationPublicKey: state.identity.publicKey,
               installationPublicKeyFingerprint: keyFingerprint(state.identity.publicKey),
               deviceFingerprint: state.identity.deviceFingerprint,
          }));
     }
     async status(id: number): Promise<SignedLicenseStatus> {
          tenantId(id);
          if (licenseMode() === 'legacy') return { mode: 'legacy', state: 'legacy', signedValid: null };
          try {
               return await this.store().update<SignedLicenseStatus>(state => {
                    observeClock(state, this.now());
                    const value = state.certificates[String(id)];
                    // Validate issuer configuration even before activation.
                    const key = this.key();
                    keyFingerprint(key);
                    if (!value) return { mode: 'signed', state: 'missing', signedValid: false, reason: 'LICENSE_MISSING' };
                    const { payload: p } = verifyCertificate(value, key, state.identity, id);
                    const period = certificatePeriod(p, state.lastSeenAt);
                    return { mode: 'signed', state: period, signedValid: period === 'active' || period === 'grace',
                         ...(period === 'expired' || period === 'not_started' ? { reason: `LICENSE_${period.toUpperCase()}` } : {}),
                         licenseId: p.licenseId, startsAt: p.startsAt, endsAt: p.endsAt, graceDays: p.graceDays };
               });
          } catch (e) {
               if (!(e instanceof LicenseError)) throw e;
               // Status is diagnostic, not a successful validation. No certificate contents or key details are exposed.
               console.warn(`[licensing] ${e.code}`);
               return { mode: 'signed', state: 'invalid', signedValid: false, reason: e.code };
          }
     }
     async activate(value: unknown, id: number): Promise<void> {
          tenantId(id);
          if (licenseMode() !== 'signed') throw new LicenseError('LICENSE_SIGNED_MODE_REQUIRED', 409);
          await this.store().update(state => {
               observeClock(state, this.now());
               const cert = verifyCertificate(value, this.key(), state.identity, id);
               if (certificatePeriod(cert.payload, state.lastSeenAt) === 'expired') throw new LicenseError('LICENSE_EXPIRED');
               state.certificates[String(id)] = cert;
          });
     }
}
