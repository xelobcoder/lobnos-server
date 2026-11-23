import { afterEach, expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { enrichMasterReferenceCatalog } from './MasterReferenceCatalog';
import type { Knex } from 'knex';

const fixture = accountingSqlDatabase();
afterEach(async () => { await fixture.db.destroy(); });

it('adds missing references without changing existing items and classifies ultrasound panels', async () => {
     fixture.native.exec(`
          CREATE TABLE sampletype (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
          CREATE TABLE samplecontainer (id INTEGER PRIMARY KEY, name TEXT NOT NULL, material TEXT);
          CREATE TABLE departments (id INTEGER PRIMARY KEY, department TEXT NOT NULL, departmentManager TEXT, employeeid INTEGER);
          CREATE TABLE test_panels (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category INTEGER NOT NULL);
          CREATE TABLE testcreationrules (id INTEGER PRIMARY KEY, testid INTEGER, plan TEXT);
          INSERT INTO sampletype VALUES (1, ' None ');
          INSERT INTO samplecontainer VALUES (1, 'none', 'existing');
          INSERT INTO departments VALUES (6, 'Ultrasound', 'owner', 7);
          INSERT INTO departments VALUES (7, 'Chemistry', 'owner', 7);
          INSERT INTO test_panels VALUES (1, 'TESTICULAR DOPPLER', 0), (2, 'MSK', 7), (3, 'DOPPLER marker chemistry', 7), (4, 'Blood glucose', 7), (5, 'TWIN FETAL ANOMALLY', 0);
          INSERT INTO testcreationrules VALUES (1, 2, 'ultrasoundFields');
     `);
     const query = async (sql: string, values: Knex.RawBinding[] = []) => fixture.db.raw(sql, values) as Promise<unknown[]>;
     await enrichMasterReferenceCatalog(query, 'main');
     const firstCounts = {
          samples: Number((await fixture.db('sampletype').count({ count: '*' }).first())!.count),
          containers: Number((await fixture.db('samplecontainer').count({ count: '*' }).first())!.count),
     };
     await enrichMasterReferenceCatalog(query, 'main');
     expect(await fixture.db('sampletype').count({ count: '*' }).first()).toEqual({ count: firstCounts.samples });
     expect(await fixture.db('samplecontainer').count({ count: '*' }).first()).toEqual({ count: firstCounts.containers });
     expect(await fixture.db('samplecontainer').where({ id: 1 }).first()).toMatchObject({ name: 'none', material: 'existing' });
     expect(await fixture.db('sampletype').where({ name: 'PLASMA' }).first()).toBeTruthy();
     expect(await fixture.db('samplecontainer').where({ name: 'HEPARIN TUBE' }).first()).toMatchObject({ material: null });
     expect(await fixture.db('test_panels').whereIn('id', [1, 2]).pluck('category')).toEqual([6, 6]);
     expect(await fixture.db('test_panels').where({ id: 3 }).first()).toMatchObject({ category: 7 });
     expect(await fixture.db('test_panels').where({ id: 5 }).first()).toMatchObject({ category: 6 });
     expect(await fixture.db('test_panels').where({ id: 4 }).first()).toMatchObject({ category: 7 });
});
