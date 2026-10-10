import fs from 'fs';
import path from 'path';
import { configuration, effectiveTenantId } from '../../hooks/configuration';

export const companyImageRoot = () => path.resolve(process.cwd(), 'dist', 'asserts', 'company');

export function companyImageTenantId(value: unknown): number | null {
     if (value === undefined && !configuration.isMultiTenant) return configuration.defaultTenantId;
     if (typeof value !== 'string' && typeof value !== 'number') return null;
     if (!/^[1-9]\d*$/.test(String(value))) return null;
     const id = Number(value);
     return Number.isSafeInteger(id) ? effectiveTenantId(id) : null;
}

export const companyImageDirectory = (tenantId: number) =>
     path.join(companyImageRoot(), 'tenants', String(effectiveTenantId(tenantId)));

export function companyImageMime(image: Buffer): string | null {
     if (image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
     if (image.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
     return null;
}

export function readCompanyImage(tenantId: number): { image: Buffer; contentType: string } | null {
     const logo = path.join(companyImageDirectory(tenantId), 'logo');
     if (fs.existsSync(logo)) {
          const image = fs.readFileSync(logo);
          const contentType = companyImageMime(image);
          return contentType ? { image, contentType } : null;
     }

     // The old shared image belongs only to this installation's original/default tenant.
     // Never search another tenant's directory or use the legacy image for a new facility.
     if (effectiveTenantId(tenantId) !== configuration.defaultTenantId) return null;
     const root = companyImageRoot();
     if (!fs.existsSync(root)) return null;
     const types: Partial<Record<string, string>> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
     const file = fs.readdirSync(root, { withFileTypes: true })
          .find(entry => entry.isFile() && types[path.extname(entry.name).toLowerCase()]);
     if (!file) return null;
     const contentType = types[path.extname(file.name).toLowerCase()];
     return contentType ? {
          image: fs.readFileSync(path.join(root, file.name)),
          contentType,
     } : null;
}
