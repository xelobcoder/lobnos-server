/** Customer-side offline CLI. No database imports, issuer tools, private signing keys, or automatic .env loading. */
import { promises as fs } from 'fs';
import path from 'path';
import { OfflineLicenseService } from '../licensing/service';
import { LicenseError, tenantId } from '../licensing/certificate';
import { storageDirectory } from '../licensing/storage';

export async function runLicenseCli(args: string[]): Promise<unknown> {
     const [command, ...rest] = args;
     const options: Record<string, string> = {};
     for (let i = 0; i < rest.length; i += 2) {
          if (!['--tenant-id', '--output', '--file'].includes(rest[i]) || !rest[i + 1] ||
               rest[i + 1].startsWith('--') || options[rest[i]] !== undefined) throw new LicenseError('LICENSE_CLI_ARGUMENTS_INVALID', 400);
          options[rest[i]] = rest[i + 1];
     }
     const allowed: Record<string, string[]> = {
          request: ['--tenant-id', '--output'], status: ['--tenant-id'], activate: ['--tenant-id', '--file'],
     };
     if (!allowed[command] || Object.keys(options).some(k => !allowed[command].includes(k)) ||
          allowed[command].some(k => !options[k])) throw new LicenseError('LICENSE_CLI_ARGUMENTS_INVALID', 400);
     const id = tenantId(options['--tenant-id']);
     const service = new OfflineLicenseService();
     if (command === 'request') {
          const output = path.resolve(options['--output']);
          const relative = path.relative(storageDirectory(), output);
          if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) {
               throw new LicenseError('LICENSE_CLI_OUTPUT_IN_STORAGE', 400);
          }
          // Refuse clobbering an existing file (including licensing state). Desktop should select a new path.
          await fs.writeFile(output, JSON.stringify(await service.request(id), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
          return { status: 'success', result: { requestExported: true } };
     }
     if (command === 'status') return { status: 'success', result: {
          ...await service.status(id), existingWindowValidation: 'not_checked',
          operationalValid: null,
     } };
     const file = options['--file'];
     const stat = await fs.stat(file);
     if (stat.size > 65536) throw new LicenseError('LICENSE_CERTIFICATE_INVALID', 400);
     let value: unknown;
     try { value = JSON.parse(await fs.readFile(file, 'utf8')); }
     catch { throw new LicenseError('LICENSE_CERTIFICATE_INVALID', 400); }
     await service.activate(value, id);
     return { status: 'success',
          message: 'Signed certificate installed. Existing validity/grace window remains authoritative and may require separate administrator renewal.',
          result: { existingWindowValidation: 'not_checked', operationalValid: null } };
}
if (require.main === module) {
     runLicenseCli(process.argv.slice(2)).then(result => {
          console.log(JSON.stringify(result));
     }).catch(e => {
          const code = e instanceof LicenseError ? e.code : 'LICENSE_CLI_IO_FAILED';
          // Sanitized JSON stderr only; no file contents, paths, device identifier, or keys.
          console.error(JSON.stringify({ status: 'error', message: code }));
          process.exitCode = 1;
     });
}
