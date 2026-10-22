import express from 'express';
import { once } from 'events';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const mocks = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connect }));
import createFileUploader, { blockPublicPatientImages, MAX_IMAGE_BYTES } from './fileuploads';
import { configuration } from '../../hooks/configuration';
import { validatedImageType } from './imageValidation';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
type Row = Record<string, any>;

function database() {
     const tables: Record<string, Row[]> = { new_patients: [{ patientid: 42 }], patientimages: [] };
     const failures = { write: false };
     const connection = (table: string) => {
          const name = table.split(' as ')[0];
          const filters: Array<(row: Row) => boolean> = [];
          let joined = false;
          const matches = (row: Row) => filters.every(filter => filter(row)) && (!joined || tables.new_patients.some(p => p.patientid === row.patientid));
          const query = {
               where: (column: string | Row, value?: unknown) => {
                    if (typeof column === 'string') filters.push(row => row[column.split('.').pop()!] === value);
                    else filters.push(row => Object.entries(column).every(([key, entry]) => row[key] === entry));
                    return query;
               },
               andWhere: (column: string, value: unknown) => query.where(column, value),
               join: (..._args: string[]) => { joined = true; return query; },
               forUpdate: () => query,
               first: async (..._columns: string[]) => tables[name].find(matches),
               update: async (changes: Row) => {
                    if (failures.write) throw new Error('Database write failed');
                    const rows = tables[name].filter(matches);
                    rows.forEach(row => Object.assign(row, changes));
                    return rows.length;
               },
               insert: async (row: Row) => {
                    if (failures.write) throw new Error('Database write failed');
                    tables[name].push(row);
               },
          };
          return query;
     };
     return { tables, failures, connection: Object.assign(connection, {
          transaction: async (run: (trx: typeof connection) => Promise<unknown>) => {
               const snapshot = structuredClone(tables);
               try { return await run(connection); }
               catch (error) { Object.assign(tables, snapshot); throw error; }
          },
     }) };
}

describe('tenant-scoped patient images', () => {
     let root: string, base: string, server: Server;
     let tenants: Map<number, ReturnType<typeof database>>;
     let originalMultiTenant: boolean;
     beforeEach(async () => {
          originalMultiTenant = configuration.isMultiTenant;
          configuration.isMultiTenant = true;
          root = await fs.mkdtemp(path.join(os.tmpdir(), 'pls-image-test-'));
          tenants = new Map([[3, database()], [4, database()]]);
          mocks.connect.mockImplementation(async (id: number) => tenants.get(id)!.connection);
          const uploader = createFileUploader(root, path.join(root, 'legacy'));
          const app = express();
          app.use(blockPublicPatientImages);
          app.use(express.static(root));
          app.use((req, _res, next) => {
               if (req.headers['x-actor-tenant']) (req as any).authUser = {
                    tenantId: Number(req.headers['x-actor-tenant']), employeeid: 1, role: req.headers['x-role'] || 'scientist',
               };
               next();
          });
          app.post('/upload', uploader.authorizeUpload, uploader.uploadSingle, uploader.handleUpload);
          app.get('/images/:filename', uploader.getImage);
          server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
     });
     afterEach(async () => {
          configuration.isMultiTenant = originalMultiTenant;
          await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
          // Only remove the exact temporary directory created by this test.
          if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('pls-image-test-')) throw new Error('Unexpected temporary path');
          await fs.rm(root, { recursive: true, force: true });
          vi.clearAllMocks();
     });

     async function upload(tenant: number, bytes = png, options: { query?: string; mime?: string; filename?: string; actor?: string; role?: string } = {}) {
          const form = new FormData();
          form.append('file', new Blob([new Uint8Array(bytes)], { type: options.mime || 'image/png' }), options.filename || 'photo.png');
          const res = await fetch(`${base}/upload?tenantId=${tenant}&patientid=42&ptid=42&category=patients${options.query || ''}`, {
               method: 'POST', body: form, headers: { 'x-actor-tenant': options.actor || String(tenant), 'x-role': options.role || 'scientist' },
          });
          return { status: res.status, body: await res.json() as any };
     }

     async function read(tenant: number, filename: string) {
          const res = await fetch(`${base}/images/${encodeURIComponent(filename)}?tenantId=${tenant}`, { headers: { 'x-actor-tenant': String(tenant) } });
          return { status: res.status, bytes: Buffer.from(await res.arrayBuffer()), cache: res.headers.get('cache-control') };
     }

     it('isolates the same patient ID in two tenants for upload, replacement and reads', async () => {
          const first = await upload(3), other = await upload(4);
          expect(first.status).toBe(200);
          expect(other.status).toBe(200);
          const firstPath = path.join(root, '3', 'patients', first.body.imagePath);
          const otherPath = path.join(root, '4', 'patients', other.body.imagePath);
          expect(await fs.readFile(firstPath)).toEqual(png);
          expect(await fs.readFile(otherPath)).toEqual(png);
          expect((await read(4, first.body.imagePath)).status).toBe(404);
          expect((await read(3, first.body.imagePath)).bytes).toEqual(png);
          const replacement = await upload(3);
          expect(replacement.status).toBe(200);
          await expect(fs.stat(firstPath)).rejects.toMatchObject({ code: 'ENOENT' });
          expect(await fs.readFile(otherPath)).toEqual(png);
          const fetched = await read(3, replacement.body.imagePath);
          expect(fetched.bytes).toEqual(png);
          expect(fetched.cache).toBe('private, no-store');
     });

     it('checks tenant, patient existence, category and identity consistency before writing', async () => {
          expect((await upload(3, png, { actor: '4' })).status).toBe(403);
          expect((await upload(3, png, { role: 'clinician' })).status).toBe(403);
          expect((await upload(3, png, { query: '&category=../../outside' })).status).toBe(400);
          expect((await upload(3, png, { query: '&ptid=99' })).status).toBe(400);
          tenants.get(3)!.tables.new_patients.length = 0;
          expect((await upload(3)).status).toBe(404);
          expect(await fs.readdir(root)).toEqual([]);
     });

     it('rejects forged MIME types, truncated images and oversized multipart data', async () => {
          expect((await upload(3, Buffer.from('<script>alert(1)</script>'))).status).toBe(415);
          expect((await upload(3, png, { mime: 'image/jpeg' })).status).toBe(415);
          expect((await upload(3, png.subarray(0, 30))).status).toBe(415);
          expect((await upload(3, Buffer.alloc(MAX_IMAGE_BYTES + 1))).status).toBe(413);
          expect(await fs.readdir(root)).toEqual([]);
     });

     it('uses the verified image type for the extension', async () => {
          const result = await upload(3, gif, { mime: 'image/gif', filename: 'payload.html' });
          expect(result.status).toBe(200);
          expect(result.body.imagePath).toMatch(/\.gif$/);
          expect(validatedImageType(gif)?.mime).toBe('image/gif');
     });

     it('keeps the current image if validation or the database update fails', async () => {
          const current = await upload(3);
          expect((await upload(3, Buffer.from('invalid'))).status).toBe(415);
          tenants.get(3)!.failures.write = true;
          expect((await upload(3)).status).toBe(500);
          expect(tenants.get(3)!.tables.patientimages[0].imagepath).toBe(current.body.imagePath);
          expect(await fs.readdir(path.join(root, '3', 'patients'))).toEqual([current.body.imagePath]);
     });

     it('requires the file reference to belong to a current patient in the selected tenant', async () => {
          const result = await upload(3);
          tenants.get(3)!.tables.patientimages.length = 0;
          expect((await read(3, result.body.imagePath)).status).toBe(404);
     });

     it('serves legacy images only with a verified patient reference in single-tenant mode', async () => {
          const filename = 'patients_42_123456.png';
          await fs.mkdir(path.join(root, 'legacy'));
          await fs.writeFile(path.join(root, 'legacy', filename), png);
          tenants.get(3)!.tables.patientimages.push({ patientid: 42, imagepath: filename });
          expect((await read(3, filename)).status).toBe(404);
          configuration.isMultiTenant = false;
          expect((await read(3, filename)).bytes).toEqual(png);
          tenants.get(3)!.tables.new_patients.length = 0;
          expect((await read(3, filename)).status).toBe(404);
     });

     it('blocks legacy public copies, including encoded and case variants', async () => {
          await fs.mkdir(path.join(root, 'uploads', 'patients'), { recursive: true });
          await fs.writeFile(path.join(root, 'uploads', 'patients', 'photo.png'), png);
          for (const url of ['/uploads/patients/photo.png', '/uploads/%70atients/photo.png', '/UPLOADS/PATIENTS/photo.png', '/uploads%5cpatients%5cphoto.png']) {
               const res = await fetch(`${base}${url}`);
               await res.arrayBuffer();
               expect(res.status).toBe(404);
          }
     });
});
