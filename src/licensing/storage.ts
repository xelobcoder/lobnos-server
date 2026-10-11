import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { createHash, generateKeyPairSync, randomBytes } from 'crypto';
import { execFileSync } from 'child_process';
import { InstallationIdentity, keyFingerprint, LicenseError, SignedCertificate } from './certificate';

export interface LicenseState {
     version: 1;
     identity: InstallationIdentity;
     lastSeenAt: number;
     certificates: Record<string, SignedCertificate>;
}
export function licenseMode(): 'legacy' | 'signed' {
     const value = process.env.PLS_LICENSE_MODE;
     if (!value || value === 'legacy') return 'legacy';
     if (value === 'signed') return 'signed';
     throw new LicenseError('LICENSE_MODE_INVALID', 503);
}
let cachedDeviceFingerprint: string | undefined;
export function deviceFingerprint(): string {
     // Machine identity is stable for the life of a process; do not spawn reg.exe on every HTTP request.
     if (cachedDeviceFingerprint) return cachedDeviceFingerprint;
     try {
          let device: string;
          if (process.platform === 'win32') {
               const systemRoot = process.env.SystemRoot || 'C:\\Windows';
               const result = execFileSync(path.join(systemRoot, 'System32', 'reg.exe'),
                    ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
                    { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
               const match = result.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]+)/i);
               if (!match) throw new Error();
               device = match[1].toLowerCase();
          } else if (process.platform === 'linux') {
               device = readFileSync('/etc/machine-id', 'utf8').trim().toLowerCase();
               if (!/^[a-f0-9]{32}$/.test(device)) throw new Error();
          } else throw new Error();
          cachedDeviceFingerprint = createHash('sha256').update(`pls-device-v1:${process.platform}:${device}`).digest('hex');
          return cachedDeviceFingerprint;
     } catch {
          throw new LicenseError('LICENSE_DEVICE_UNAVAILABLE', 503);
     }
}
export function storageDirectory(): string {
     const dir = process.env.PLS_LICENSE_STORAGE_DIR;
     if (!dir || !path.isAbsolute(dir)) throw new LicenseError('LICENSE_STORAGE_DIR_REQUIRED', 503);
     // Reject paths inside the checkout/distribution, including dist. Resolve symlinks when present.
     let root = path.resolve(__dirname, '..');
     while (path.dirname(root) !== root) {
          try { readFileSync(path.join(root, 'package.json')); break; } catch { root = path.dirname(root); }
     }
     if (path.dirname(root) === root) root = path.resolve(__dirname, '../..');
     const relative = path.relative(root, path.resolve(dir));
     if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) {
          throw new LicenseError('LICENSE_STORAGE_INSIDE_RUNTIME', 503);
     }
     return dir;
}
export function issuerPublicKey(): string {
     const pem = process.env.PLS_LICENSE_PUBLIC_KEY;
     const file = process.env.PLS_LICENSE_PUBLIC_KEY_FILE;
     if (!!pem === !!file) throw new LicenseError('LICENSE_PUBLIC_KEY_REQUIRED', 503);
     try {
          const result = pem || readFileSync(file!, 'utf8');
          if (result.length > 16384) throw new Error();
          return result;
     } catch { throw new LicenseError('LICENSE_PUBLIC_KEY_INVALID', 503); }
}

/** One lock and one atomic state-file replacement serialize activation and clock observations across processes. */
export class LicenseStorage {
     constructor(private directory = storageDirectory(), private fingerprint = deviceFingerprint) {}

     async update<T>(work: (state: LicenseState) => T | Promise<T>): Promise<T> {
          let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
          let temporary: string | undefined;
          const lockPath = path.join(this.directory, 'license.lock');
          try {
               await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
               // A symlink/junction must not defeat the external-storage requirement.
               if (this.directory === process.env.PLS_LICENSE_STORAGE_DIR) {
                    const real = await fs.realpath(this.directory);
                    const previous = process.env.PLS_LICENSE_STORAGE_DIR;
                    // No global env mutations; check the resolved directory against the runtime root too.
                    const normalize = (p: string) => process.platform === 'win32' ? p.toLowerCase() : p;
                    if (normalize(real) !== normalize(path.resolve(previous!))) throw new LicenseError('LICENSE_STORAGE_LINK_NOT_ALLOWED', 503);
               }
               for (let attempt = 0; attempt < 100; attempt++) {
                    try { lock = await fs.open(lockPath, 'wx', 0o600); break; }
                    catch (e: any) {
                         if (e.code !== 'EEXIST') throw e;
                         await new Promise(resolve => setTimeout(resolve, 25));
                    }
               }
               if (!lock) throw new LicenseError('LICENSE_STORAGE_BUSY', 503);
               const statePath = path.join(this.directory, 'license-state.json');
               let state: LicenseState;
               try {
                    const stat = await fs.stat(statePath);
                    if (stat.size > 1024 * 1024) throw new Error();
                    state = JSON.parse(await fs.readFile(statePath, 'utf8'));
               } catch (e: any) {
                    if (e.code !== 'ENOENT') throw new LicenseError('LICENSE_STATE_INVALID', 503);
                    // The installation public key is a random public identity, not an issuer key or proof of possession.
                    // Its unused private half is discarded; no private signing key is persisted in the customer runtime.
                    const { publicKey } = generateKeyPairSync('ed25519');
                    state = {
                         version: 1,
                         identity: { version: 1, installationId: randomBytes(16).toString('hex'),
                              publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
                              deviceFingerprint: this.fingerprint() },
                         lastSeenAt: 0, certificates: {},
                    };
               }
               if (state.version !== 1 || !state.identity || state.identity.version !== 1 ||
                    !/^[a-f0-9]{32}$/.test(state.identity.installationId) ||
                    !/^[a-f0-9]{64}$/.test(state.identity.deviceFingerprint) ||
                    !Number.isSafeInteger(state.lastSeenAt) || state.lastSeenAt < 0 ||
                    !state.certificates || typeof state.certificates !== 'object' || Array.isArray(state.certificates)) {
                    throw new LicenseError('LICENSE_STATE_INVALID', 503);
               }
               keyFingerprint(state.identity.publicKey);
               if (state.identity.deviceFingerprint !== this.fingerprint()) throw new LicenseError('LICENSE_DEVICE_MISMATCH');
               const result = await work(state);
               temporary = path.join(this.directory, `.license-${randomBytes(16).toString('hex')}.tmp`);
               const handle = await fs.open(temporary, 'wx', 0o600);
               try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
               await fs.rename(temporary, statePath);
               temporary = undefined;
               return result;
          } catch (e) {
               if (e instanceof LicenseError) throw e;
               throw new LicenseError('LICENSE_STORAGE_FAILED', 503);
          } finally {
               if (temporary) await fs.unlink(temporary).catch(() => undefined);
               if (lock) {
                    await lock.close();
                    await fs.unlink(lockPath).catch(() => undefined);
               }
          }
     }
}
