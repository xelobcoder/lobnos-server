import type { Knex } from 'knex';

const SAMPLE_TYPES = [
     'PLASMA', 'WHOLE BLOOD', 'SALIVA', 'SEMEN', 'PLEURAL FLUID',
     'SYNOVIAL FLUID', 'TISSUE', 'BONE MARROW', 'AMNIOTIC FLUID', 'NONE',
];
const CONTAINERS = [
     'PLAIN TUBE', 'HEPARIN TUBE', 'BLOOD CULTURE BOTTLE',
     'STERILE SPECIMEN CONTAINER', 'CRYOVIAL', 'NONE',
];
const ANTIBIOTICS = [
     'Ampicillin',
     'Amoxicillin-Clavulanic Acid',
     'Piperacillin-Tazobactam',
     'Cefuroxime',
     'Cefotaxime',
     'Ceftriaxone',
     'Ceftazidime',
     'Cefepime',
     'Cefoxitin',
     'Cefixime',
     'Cefazolin',
     'Imipenem',
     'Meropenem',
     'Ertapenem',
     'Aztreonam',
     'Gentamicin',
     'Amikacin',
     'Tobramycin',
     'Ciprofloxacin',
     'Levofloxacin',
     'Ofloxacin',
     'Nalidixic Acid',
     'Cotrimoxazole (Trimethoprim-Sulfamethoxazole)',
     'Nitrofurantoin',
     'Fosfomycin',
     'Tetracycline',
     'Doxycycline',
     'Chloramphenicol',
     'Erythromycin',
     'Azithromycin',
     'Clindamycin',
     'Linezolid',
     'Vancomycin',
     'Teicoplanin',
     'Penicillin G',
     'Oxacillin',
     'Rifampicin',
     'Mupirocin',
     'Colistin',
     'Polymyxin B',
] as const;

type CatalogQuery = (sql: string, values?: Knex.RawBinding[]) => Promise<unknown[]>;
type NamedRow = { id: number; name: string };
const normalized = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const ultrasoundName = /\b(?:usg|ultrasound|ultrasonograph(?:y|ic)?)\b|\b(?:testicular|scrotal|femoral)\s+doppler\b|\btwin\s+fetal\s+anomall?y\b/i;

/** Run within the caller's transaction and master-catalog write lock. */
export async function enrichMasterReferenceCatalog(query: CatalogQuery, database: string): Promise<void> {
     for (const [table, names] of [['sampletype', SAMPLE_TYPES], ['samplecontainer', CONTAINERS]] as const) {
          const existing = await query('SELECT id, name FROM ??.??', [database, table]) as NamedRow[];
          const known = new Set(existing.map(row => normalized(row.name)));
          for (const name of names) {
               if (known.has(normalized(name))) continue;
               await query('INSERT INTO ??.?? (name) VALUES (?)', [database, table, name]);
               known.add(normalized(name));
          }
     }
     const departments = await query('SELECT id, department AS name FROM ??.??', [database, 'departments']) as NamedRow[];
     const matches = departments.filter(row => normalized(row.name) === 'ultrasound');
     if (matches.length > 1) throw new Error('Multiple ultrasound departments exist; resolve the ambiguity before catalog migration');
     if (!matches.length) {
          await query('INSERT INTO ??.?? (department, departmentManager, employeeid) VALUES (?, ?, ?)',
               [database, 'departments', 'Ultrasound', 'Master catalog', 1]);
          const created = await query('SELECT id, department AS name FROM ??.?? WHERE department = ?',
               [database, 'departments', 'Ultrasound']) as NamedRow[];
          if (created.length !== 1) throw new Error('Unable to identify the ultrasound department');
          matches.push(created[0]);
     }
     const panels = await query(`SELECT p.id, p.name, p.category,
          MAX(CASE WHEN r.plan IN ('ultrasoundFields', 'fetalBiometry') THEN 1 ELSE 0 END) AS imaging
          FROM ??.?? p LEFT JOIN ??.?? r ON r.testid = p.id GROUP BY p.id, p.name, p.category`,
          [database, 'test_panels', database, 'testcreationrules']) as Array<NamedRow & { category: number; imaging: number }>;
     for (const panel of panels) {
          if ((ultrasoundName.test(panel.name) || Number(panel.imaging) === 1) && Number(panel.category) !== Number(matches[0].id)) {
               await query('UPDATE ??.?? SET category = ? WHERE id = ?', [database, 'test_panels', matches[0].id, panel.id]);
          }
     }
     await seedMasterAntibioticCatalog(query, database);
}

export async function seedMasterAntibioticCatalog(query: CatalogQuery, database: string): Promise<void> {
     const antibioticCategories = await query(
          'SELECT id FROM ??.?? WHERE LOWER(TRIM(categoryName)) = ?',
          [database, 'drugscategory', normalized('Antibiotics')],
     ) as Array<{ id: number }>;
     if (antibioticCategories.length > 1) throw new Error('Multiple Antibiotics categories exist; resolve the ambiguity before catalog seeding');
     let antibioticCategoryId = Number(antibioticCategories[0]?.id || 0);
     if (!antibioticCategoryId) {
          await query('INSERT INTO ??.?? (categoryName, description, createdBy) VALUES (?, ?, ?)',
               [database, 'drugscategory', 'Antibiotics', 'Antibiotics used in culture and sensitivity testing', 'Prime Laboratory Software']);
          const created = await query('SELECT id FROM ??.?? WHERE LOWER(TRIM(categoryName)) = ?',
               [database, 'drugscategory', normalized('Antibiotics')]) as Array<{ id: number }>;
          if (created.length !== 1) throw new Error('Unable to identify the Antibiotics category');
          antibioticCategoryId = Number(created[0].id);
     }
     const existingAntibiotics = await query('SELECT id, drug FROM ??.?? WHERE category = ?',
          [database, 'drugs', antibioticCategoryId]) as Array<{ id: number; drug: string }>;
     for (const drug of ANTIBIOTICS) {
          const matching = existingAntibiotics.filter(row => normalized(row.drug) === normalized(drug));
          if (matching.length > 1) throw new Error(`Multiple master drugs match "${drug}" in Antibiotics`);
          if (matching.length === 1) continue;
          await query('INSERT INTO ??.?? (drug, category, createdby) VALUES (?, ?, ?)',
               [database, 'drugs', drug, antibioticCategoryId, 1]);
          existingAntibiotics.push({ id: 0, drug });
     }
}

export async function enrichStandaloneMasterReferenceCatalog(trx: Knex.Transaction, database: string): Promise<void> {
     await enrichMasterReferenceCatalog(async (sql, values = []) => {
          const [rows] = await trx.raw(sql, values);
          return rows;
     }, database);
}
