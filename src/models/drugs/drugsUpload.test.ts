import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));

import { DrugManagementService } from './drugsUpload';

let fixture: ReturnType<typeof accountingSqlDatabase>;

beforeEach(() => {
     fixture = accountingSqlDatabase();
     fixture.native.exec(`
          CREATE TABLE drugscategory (id INTEGER PRIMARY KEY, categoryName TEXT NOT NULL);
          CREATE TABLE drugs (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               drug TEXT NOT NULL,
               category INTEGER,
               createdby INTEGER NOT NULL,
               addedOn TEXT
          );
     `);
     mocks.connection.mockResolvedValue(fixture.db);
});

afterEach(async () => {
     await fixture.db.destroy();
     vi.clearAllMocks();
});

it('adds multiple facility drugs in one transaction', async () => {
     await fixture.db('drugscategory').insert([
          { id: 4, categoryName: 'Antibiotics' },
          { id: 5, categoryName: 'Antifungals' },
     ]);
     const result = await new DrugManagementService().addMultipleDrugs(
          2,
          [
               { drug: 'Amoxicillin', category: 4 },
               { drug: 'Fluconazole', category: 5 },
          ],
          7,
     );

     expect(result).toBe(2);
     expect(await fixture.db('drugs').select('drug', 'category', 'createdby').orderBy('id')).toEqual([
          { drug: 'Amoxicillin', category: 4, createdby: 7 },
          { drug: 'Fluconazole', category: 5, createdby: 7 },
     ]);
});

it('rejects duplicate batch entries without partially inserting drugs', async () => {
     await fixture.db('drugscategory').insert({ id: 4, categoryName: 'Antibiotics' });
     const result = await new DrugManagementService().addMultipleDrugs(
          2,
          [
               { drug: 'Amoxicillin', category: 4 },
               { drug: ' amoxicillin ', category: 4 },
          ],
          7,
     );

     expect(result).toContain('Duplicate drug name');
     expect(await fixture.db('drugs')).toHaveLength(0);
});

it('rejects a batch that contains an existing drug without partially inserting', async () => {
     await fixture.db('drugscategory').insert({ id: 4, categoryName: 'Antibiotics' });
     await fixture.db('drugs').insert({ drug: 'Amoxicillin', category: 4, createdby: 7 });

     const result = await new DrugManagementService().addMultipleDrugs(
          2,
          [
               { drug: 'Ciprofloxacin', category: 4 },
               { drug: 'amoxicillin', category: 4 },
          ],
          7,
     );

     expect(result).toContain('already exists');
     expect(await fixture.db('drugs').select('drug')).toEqual([{ drug: 'Amoxicillin' }]);
});
