import path from 'node:path';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export function logoMediaType(bytes: Buffer) {
    if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
    if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    throw new Error('Upload a PNG or JPEG image.');
}
/** Never infer ownership of old shared ID-only files: those files can belong to another tenant. */
export class OrganizationLogoStore {
    constructor(private root = path.resolve('asserts', 'tenant-organization-logos')) {}
    private directory(tenant: number, organization: number) {
        if (![tenant, organization].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Invalid organization identity');
        return path.join(this.root, String(tenant), String(organization));
    }
    async save(tenant: number, organization: number, bytes: Buffer) {
        if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Choose an image up to 5 MB.');
        logoMediaType(bytes);
        const directory = this.directory(tenant, organization);
        await mkdir(directory, {recursive: true});
        const temporary = path.join(directory, randomUUID() + '.upload');
        try { await writeFile(temporary, bytes, {flag: 'wx'}); await rename(temporary, path.join(directory, 'logo')); }
        finally { await unlink(temporary).catch(() => {}); }
    }
    async read(tenant: number, organization: number) {
        try { const bytes = await readFile(path.join(this.directory(tenant, organization), 'logo')); return {bytes, mediaType: logoMediaType(bytes)}; }
        catch (error: any) { if (error.code === 'ENOENT') return null; throw error; }
    }
}
