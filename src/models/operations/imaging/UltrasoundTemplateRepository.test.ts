import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));

import { UltrasoundTemplateRepository, ultrasoundTemplateSchema } from './UltrasoundTemplateRepository';
import * as queries from '../../creator/queries';

const input = () => ultrasoundTemplateSchema.parse({
     testid: 100221, employeeid: 9, name: 'Kidney template', associatedbodypart: 'Kidney', visibleToAll: 1,
     fields: [{ name: 'Findings', id: 21, value: '<p>Normal</p>' }],
});

function database() {
     let tables: Record<string, Record<string, unknown>[]> = {
          ultrasoundtemplatesmapper: [], ultrasoundtemplates: [], test_results: [{ keyid: 1, value: 'Patient report' }],
     };
     let failInsert = false;
     let failMapperDelete = false;
     const touched: string[] = [];
     const db: any = (name: string) => {
          if (!(name in tables)) throw Object.assign(new Error('Case-sensitive table not found'), { code: 'ER_NO_SUCH_TABLE' });
          touched.push(name);
          const filters: Record<string, unknown>[] = [];
          const rows = () => tables[name].filter(row => filters.every(filter => Object.entries(filter).every(([key, value]) => row[key] === value)));
          const query = {
               where(filter: Record<string, unknown>) { filters.push(filter); return query; },
               forUpdate() { return query; },
               async first() { return rows()[0]; },
               async insert(value: Record<string, unknown> | Record<string, unknown>[]) {
                    if (name === 'ultrasoundtemplates' && failInsert) throw new Error('Field insert failed');
                    const items = Array.isArray(value) ? value : [value];
                    for (const item of items) tables[name].push({ keyid: tables[name].length + 1, ...item });
                    return [tables[name][tables[name].length - 1]?.keyid];
               },
               async update(value: Record<string, unknown>) { const matched = rows(); matched.forEach(row => Object.assign(row, value)); return matched.length; },
               async del() {
                    if (name === 'ultrasoundtemplatesmapper' && failMapperDelete) throw new Error('Mapper delete failed');
                    const matched = new Set(rows());
                    tables[name] = tables[name].filter(row => !matched.has(row));
                    return matched.size;
               },
          };
          return query;
     };
     db.fn = { now: () => 'NOW' };
     db.transaction = async (work: (trx: typeof db) => Promise<unknown>) => {
          const snapshot = structuredClone(tables);
          try { return await work(db); } catch (error) { tables = snapshot; throw error; }
     };
     return { db, rows: (table: string) => tables[table], touched,
          failInsert: () => { failInsert = true; }, failMapperDelete: () => { failMapperDelete = true; } };
}

describe('ultrasound template persistence on case-sensitive databases', () => {
     beforeEach(() => vi.clearAllMocks());

     it('uses the exact exported lowercase mapper name in every legacy query', () => {
          const ddl = readFileSync(join(__dirname, '..', '..', '..', '..', 'db-exports', 'primelabmaster', 'tables-structure', 'primelabtestmig_ultrasoundtemplatesmapper.sql'), 'utf8');
          expect(ddl).toContain('CREATE TABLE `ultrasoundtemplatesmapper`');
          for (const [name, sql] of Object.entries(queries)) {
               if (!name.includes('ultrasound')) continue;
               expect(sql).not.toContain('ultrasoundtemplatesMapper');
          }
          expect(queries.q_get_ultrasound_template_mapper).not.toMatch(/GROUP BY/i);
     });

     it('accepts creation-rule and previously saved field shapes without losing field IDs', () => {
          expect(input().fields[0]).toEqual({ field: 'Findings', fieldid: 21, value: '<p>Normal</p>' });
          expect(ultrasoundTemplateSchema.parse({ ...input(), visibleToAll: '0' }).visibleToAll).toBe(0);
          for (const fields of [[{ field: 'Findings', value: '' }], [{ fieldid: 21, value: '' }], []]) {
               expect(ultrasoundTemplateSchema.safeParse({ ...input(), fields }).success).toBe(false);
          }
          expect(ultrasoundTemplateSchema.safeParse({ ...input(), testid: [1] }).success).toBe(false);
     });

     it('creates the mapper and fields in the selected tenant using lowercase names', async () => {
          const memory = database();
          mocks.connection.mockResolvedValue(memory.db);
          expect(await new UltrasoundTemplateRepository(811171).create(input())).toBe(true);
          expect(mocks.connection).toHaveBeenCalledWith(811171);
          expect(memory.rows('ultrasoundtemplatesmapper')[0]).toMatchObject({ keyid: 1, createdby: 9 });
          expect(memory.rows('ultrasoundtemplates')[0]).toMatchObject({ templateid: 1, fieldid: 21 });
     });

     it('rolls back the mapper if creating a field fails and propagates the error', async () => {
          const memory = database();
          memory.failInsert();
          mocks.connection.mockResolvedValue(memory.db);
          await expect(new UltrasoundTemplateRepository(811171).create(input())).rejects.toThrow('Field insert failed');
          expect(memory.rows('ultrasoundtemplatesmapper')).toHaveLength(0);
     });

     it('updates fields, inserts new fields with IDs, and preserves the original creator', async () => {
          const memory = database();
          mocks.connection.mockResolvedValue(memory.db);
          const repo = new UltrasoundTemplateRepository(811171);
          await repo.create(input());
          const edited = { ...input(), keyid: 1, employeeid: 42, fields: [
               { field: 'Findings', fieldid: 21, value: 'Updated' }, { field: 'Impression', fieldid: 22, value: 'Normal' },
          ] };
          expect(await repo.update(edited)).toBe(true);
          expect(await repo.update(edited)).toBe(true);
          expect(memory.rows('ultrasoundtemplates')).toHaveLength(2);
          expect(memory.rows('ultrasoundtemplates')[1]).toMatchObject({ templateid: 1, fieldid: 22 });
          expect(memory.rows('ultrasoundtemplatesmapper')[0].createdby).toBe(9);
     });

     it.each([false, true])('deletes only the selected template and fields; privileged=%s', async privileged => {
          const memory = database();
          mocks.connection.mockResolvedValue(memory.db);
          const repo = new UltrasoundTemplateRepository(811171);
          await repo.create(input());
          await repo.create({ ...input(), name: 'Keep' });
          expect(await repo.delete(1, privileged ? 42 : 9, privileged)).toBe('deleted');
          expect(memory.rows('ultrasoundtemplatesmapper').map(row => row.name)).toEqual(['Keep']);
          expect(memory.rows('ultrasoundtemplates').map(row => row.templateid)).toEqual([2]);
          expect(memory.rows('test_results')).toEqual([{ keyid: 1, value: 'Patient report' }]);
          expect(await repo.delete(1, 9, false)).toBe('not_found');
     });

     it('rolls back edited metadata if inserting a new report field fails', async () => {
          const memory = database();
          mocks.connection.mockResolvedValue(memory.db);
          const repo = new UltrasoundTemplateRepository(811171);
          await repo.create(input());
          memory.failInsert();
          await expect(repo.update({ ...input(), keyid: 1, name: 'Do not keep', fields: [
               { field: 'New field', fieldid: 22, value: 'Failed insert' },
          ] })).rejects.toThrow('Field insert failed');
          expect(memory.rows('ultrasoundtemplatesmapper')[0].name).toBe('Kidney template');
          expect(memory.rows('ultrasoundtemplates')).toHaveLength(1);
     });

     it('refuses another employee without mutating templates', async () => {
          const memory = database();
          mocks.connection.mockResolvedValue(memory.db);
          const repo = new UltrasoundTemplateRepository(811171);
          await repo.create(input());
          expect(await repo.delete(1, 42, false)).toBe('forbidden');
          expect(memory.rows('ultrasoundtemplatesmapper')).toHaveLength(1);
          expect(memory.rows('ultrasoundtemplates')).toHaveLength(1);
     });

     it('rolls back field deletion when mapper deletion fails', async () => {
          const memory = database();
          mocks.connection.mockResolvedValue(memory.db);
          const repo = new UltrasoundTemplateRepository(811171);
          await repo.create(input());
          memory.failMapperDelete();
          await expect(repo.delete(1, 9, false)).rejects.toThrow('Mapper delete failed');
          expect(memory.rows('ultrasoundtemplates')).toHaveLength(1);
          expect(memory.rows('ultrasoundtemplatesmapper')).toHaveLength(1);
     });

     it('keeps identically numbered templates isolated by tenant', async () => {
          const first = database(), second = database();
          mocks.connection.mockImplementation(async tenantId => tenantId === 811171 ? first.db : second.db);
          const repo = new UltrasoundTemplateRepository(811171);
          await repo.create(input());
          await new UltrasoundTemplateRepository(222222).create(input());
          await repo.delete(1, 9, false);
          expect(first.rows('ultrasoundtemplatesmapper')).toHaveLength(0);
          expect(second.rows('ultrasoundtemplatesmapper')).toHaveLength(1);
     });
});
