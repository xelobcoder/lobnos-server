import type { Knex } from 'knex';
import { systemConfigConnection } from '../../database/connection';

type MasterDrugCategory = { id: number; categoryName: string; description: string | null };
type MasterDrug = { drug: string; category: number; addedOn: Date | string | null };

const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export class MasterDrugCatalogImporter {
     constructor(private masterDb: Knex = systemConfigConnection) {}

     async importInto(facilityDb: Knex, createdBy: number) {
          if (!Number.isSafeInteger(Number(createdBy)) || Number(createdBy) < 1) {
               throw new Error('A valid facility employee is required to import the master drug catalog');
          }

          const [categories, drugs] = await Promise.all([
               this.masterDb<MasterDrugCategory>('drugscategory').select('id', 'categoryName', 'description').orderBy('id'),
               this.masterDb<MasterDrug>('drugs').select('drug', 'category', 'addedOn').orderBy('id'),
          ]);

          return facilityDb.transaction(async trx => {
               const categoryIds = new Map<string, number>();
               const existingCategories = await trx('drugscategory').select('id', 'categoryName').orderBy('id');
               for (const category of existingCategories) {
                    const key = normalize(category.categoryName);
                    if (key && !categoryIds.has(key)) categoryIds.set(key, Number(category.id));
               }

               let categoriesAdded = 0;
               for (const category of categories) {
                    const key = normalize(category.categoryName);
                    if (!key) throw new Error('The master drug catalog contains a category without a name');
                    if (categoryIds.has(key)) continue;
                    const [id] = await trx('drugscategory').insert({
                         categoryName: String(category.categoryName).trim().replace(/\s+/g, ' '),
                         description: category.description,
                         createdBy: 'Master catalog',
                    });
                    categoryIds.set(key, Number(id));
                    categoriesAdded++;
               }

               const existingDrugs = await trx('drugs').select('drug', 'category');
               const drugKeys = new Set(existingDrugs.map(row => `${Number(row.category)}:${normalize(row.drug)}`));
               let drugsAdded = 0;
               for (const drug of drugs) {
                    const category = categories.find(item => Number(item.id) === Number(drug.category));
                    const categoryId = category && categoryIds.get(normalize(category.categoryName));
                    const drugName = String(drug.drug ?? '').trim().replace(/\s+/g, ' ');
                    if (!categoryId) throw new Error(`Master drug "${drugName}" references a missing category`);
                    if (!normalize(drugName)) throw new Error('The master drug catalog contains a drug without a name');
                    const key = `${categoryId}:${normalize(drugName)}`;
                    if (drugKeys.has(key)) continue;
                    try {
                         await trx('drugs').insert({
                              drug: drugName,
                              category: categoryId,
                              createdby: Number(createdBy),
                              addedOn: drug.addedOn,
                         });
                         drugKeys.add(key);
                         drugsAdded++;
                    } catch (error: any) {
                         if (error?.code !== 'ER_DUP_ENTRY') throw error;
                         drugKeys.add(key);
                    }
               }

               return { categoriesAdded, drugsAdded };
          });
     }
}
