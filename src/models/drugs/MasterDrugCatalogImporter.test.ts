import { afterEach, beforeEach, expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { MasterDrugCatalogImporter } from './MasterDrugCatalogImporter';

let master: ReturnType<typeof accountingSqlDatabase>;
let facility: ReturnType<typeof accountingSqlDatabase>;

function createDrugTables(database: ReturnType<typeof accountingSqlDatabase>) {
     database.native.exec(`
          CREATE TABLE drugscategory (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               categoryName TEXT NOT NULL,
               description TEXT,
               createdBy TEXT NOT NULL
          );
          CREATE TABLE drugs (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               drug TEXT NOT NULL,
               category INTEGER,
               createdby INTEGER NOT NULL,
               addedOn TEXT
          );
     `);
}

beforeEach(() => {
     master = accountingSqlDatabase();
     facility = accountingSqlDatabase();
     createDrugTables(master);
     createDrugTables(facility);
});

afterEach(async () => {
     await Promise.all([master.db.destroy(), facility.db.destroy()]);
});

it('imports missing categories and drugs idempotently while preserving facility entries', async () => {
     await master.db('drugscategory').insert([
          { categoryName: 'Antibiotic', description: 'Master category', createdBy: 'Master catalog' },
          { categoryName: 'Antifungal', description: null, createdBy: 'Master catalog' },
     ]);
     await master.db('drugs').insert([
          { drug: 'Ciprofloxacin', category: 1, createdby: 1 },
          { drug: 'Fluconazole', category: 2, createdby: 1 },
          { drug: 'Ampicillin', category: 1, createdby: 1 },
     ]);
     await facility.db('drugscategory').insert([
          { categoryName: '  ANTIBIOTIC  ', description: 'Local category', createdBy: 'Facility admin' },
          { categoryName: 'Local only', description: null, createdBy: 'Facility admin' },
     ]);
     await facility.db('drugs').insert([
          { drug: ' ciprofloxacin ', category: 1, createdby: 7 },
          { drug: 'Local drug', category: 2, createdby: 7 },
     ]);

     const importer = new MasterDrugCatalogImporter(master.db);
     expect(await importer.importInto(facility.db, 7)).toEqual({ categoriesAdded: 1, drugsAdded: 2 });
     expect(await importer.importInto(facility.db, 7)).toEqual({ categoriesAdded: 0, drugsAdded: 0 });

     expect(await facility.db('drugscategory').select('categoryName').orderBy('id')).toEqual([
          { categoryName: '  ANTIBIOTIC  ' },
          { categoryName: 'Local only' },
          { categoryName: 'Antifungal' },
     ]);
     expect(await facility.db('drugs').select('drug', 'category').orderBy('id')).toEqual([
          { drug: ' ciprofloxacin ', category: 1 },
          { drug: 'Local drug', category: 2 },
          { drug: 'Fluconazole', category: 3 },
          { drug: 'Ampicillin', category: 1 },
     ]);
});

it('rejects invalid facility authors before starting an import', async () => {
     const importer = new MasterDrugCatalogImporter(master.db);
     await expect(importer.importInto(facility.db, 0)).rejects.toThrow('valid facility employee');
});

it('rolls back category additions if a master drug references a missing category', async () => {
     await master.db('drugscategory').insert({
          categoryName: 'New category',
          description: null,
          createdBy: 'Master catalog',
     });
     await master.db('drugs').insert({ drug: 'Uncategorized', category: 99, createdby: 1 });

     const importer = new MasterDrugCatalogImporter(master.db);
     await expect(importer.importInto(facility.db, 7)).rejects.toThrow('references a missing category');
     expect(await facility.db('drugscategory')).toHaveLength(0);
     expect(await facility.db('drugs')).toHaveLength(0);
});
