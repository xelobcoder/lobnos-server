import { createHash, createPublicKey, KeyObject, verify } from 'crypto';

export class LicenseError extends Error {
     constructor(public code: string, public statusCode = 403) {
          super(code);
     }
}

export interface LicensePayload {
     version: 1;
     licenseId: string;
     tenantId: number;
     installationId: string;
     installationPublicKeyFingerprint: string;
     deviceFingerprint: string;
     startsAt: string;
     endsAt: string;
     graceDays: number;
     /** Informational entitlements in v1; not a feature-level authorization mechanism. */
     features?: string[];
}
export interface SignedCertificate { payload: LicensePayload; signature: string }
export interface InstallationIdentity {
     version: 1;
     installationId: string;
     publicKey: string;
     deviceFingerprint: string;
}

export function tenantId(value: unknown): number {
     if (!(typeof value === 'number' || (typeof value === 'string' && /^[1-9]\d*$/.test(value)))) {
          throw new LicenseError('LICENSE_INVALID_TENANT', 400);
     }
     const id = Number(value);
     if (!Number.isSafeInteger(id) || id <= 0) throw new LicenseError('LICENSE_INVALID_TENANT', 400);
     return id;
}
export function publicKey(pem: string): KeyObject {
     try {
          // Do not accept a private PEM even though createPublicKey can derive its public half.
          if (typeof pem !== 'string' || !pem.startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error();
          const key = createPublicKey(pem);
          if (key.asymmetricKeyType !== 'ed25519') throw new Error();
          return key;
     } catch {
          throw new LicenseError('LICENSE_PUBLIC_KEY_INVALID', 503);
     }
}
export function keyFingerprint(pem: string): string {
     return createHash('sha256').update(publicKey(pem).export({ type: 'spki', format: 'der' }) as Buffer).digest('hex');
}
function object(value: unknown): value is Record<string, unknown> {
     return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function parseCertificate(value: unknown): SignedCertificate {
     const invalid = () => { throw new LicenseError('LICENSE_CERTIFICATE_INVALID', 400); };
     if (!object(value) || Object.keys(value).sort().join(',') !== 'payload,signature') return invalid();
     const p = value.payload;
     if (!object(p)) return invalid();
     const required = ['version', 'licenseId', 'tenantId', 'installationId', 'installationPublicKeyFingerprint', 'deviceFingerprint', 'startsAt', 'endsAt', 'graceDays'];
     if (required.some(k => !(k in p)) || Object.keys(p).some(k => !required.includes(k) && k !== 'features')) return invalid();
     if (p.version !== 1 || typeof p.tenantId !== 'number') return invalid();
     tenantId(p.tenantId);
     if (typeof p.licenseId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.licenseId)) return invalid();
     if (typeof p.installationId !== 'string' || !/^[a-f0-9]{32}$/.test(p.installationId)) return invalid();
     for (const k of ['installationPublicKeyFingerprint', 'deviceFingerprint']) {
          if (typeof p[k] !== 'string' || !/^[a-f0-9]{64}$/.test(p[k] as string)) return invalid();
     }
     for (const k of ['startsAt', 'endsAt']) {
          const d = p[k];
          if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(d) ||
               !Number.isFinite(Date.parse(d)) || new Date(d).toISOString() !== d) return invalid();
     }
     if (Date.parse(p.startsAt as string) > Date.parse(p.endsAt as string) ||
          !Number.isSafeInteger(p.graceDays) || Number(p.graceDays) < 0 || Number(p.graceDays) > 365) return invalid();
     if ('features' in p && (!Array.isArray(p.features) || p.features.length > 100 ||
          p.features.some(f => typeof f !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(f)) ||
          new Set(p.features).size !== p.features.length)) return invalid();
     if (typeof value.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value.signature) ||
          Buffer.from(value.signature, 'base64').toString('base64') !== value.signature) return invalid();
     return value as unknown as SignedCertificate;
}

/** Fixed field order, no whitespace; feature array order is preserved. Shared with offline issuer tooling. */
export function canonicalPayload(p: LicensePayload): Buffer {
     return Buffer.from(JSON.stringify({
          version: p.version, licenseId: p.licenseId, tenantId: p.tenantId,
          installationId: p.installationId,
          installationPublicKeyFingerprint: p.installationPublicKeyFingerprint,
          deviceFingerprint: p.deviceFingerprint,
          startsAt: p.startsAt, endsAt: p.endsAt, graceDays: p.graceDays,
          ...(p.features === undefined ? {} : { features: p.features }),
     }), 'utf8');
}
export function verifyCertificate(value: unknown, issuerPem: string, identity: InstallationIdentity, id: number): SignedCertificate {
     const cert = parseCertificate(value);
     if (!verify(null, canonicalPayload(cert.payload), publicKey(issuerPem), Buffer.from(cert.signature, 'base64'))) {
          throw new LicenseError('LICENSE_SIGNATURE_INVALID');
     }
     const p = cert.payload;
     if (p.tenantId !== tenantId(id)) throw new LicenseError('LICENSE_TENANT_MISMATCH');
     if (p.installationId !== identity.installationId ||
          p.installationPublicKeyFingerprint !== keyFingerprint(identity.publicKey)) throw new LicenseError('LICENSE_INSTALLATION_MISMATCH');
     if (p.deviceFingerprint !== identity.deviceFingerprint) throw new LicenseError('LICENSE_DEVICE_MISMATCH');
     return cert;
}
export function certificatePeriod(p: LicensePayload, now: number): 'active' | 'grace' | 'not_started' | 'expired' {
     if (now < Date.parse(p.startsAt)) return 'not_started';
     if (now <= Date.parse(p.endsAt)) return 'active';
     return now <= Date.parse(p.endsAt) + p.graceDays * 86400000 ? 'grace' : 'expired';
}
