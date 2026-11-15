import { expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { collectionCenterSnapshot, collectionCentersTable } from './SampleCollectionCenters';

it('resolves two sites independently and blocks inactive and cross-branch selections', async () => {
     const { db } = accountingSqlDatabase();
     try {
          await db.schema.createTable(collectionCentersTable, table => {
               table.increments('id');
               table.integer('branch_id');
               table.string('name');
               table.boolean('active');
          });
          await db(collectionCentersTable).insert([
               { id: 1, branch_id: 4, name: 'North Collection Center', active: true },
               { id: 2, branch_id: 4, name: 'Market Collection Center', active: true },
               { id: 3, branch_id: 5, name: 'Other Branch', active: true },
          ]);
          await db.transaction(async trx => {
               const north = await collectionCenterSnapshot(trx, 1, 4);
               expect(north).toEqual({ collection_center_id: 1, collection_center_name: 'North Collection Center' });
               expect(await collectionCenterSnapshot(trx, 2, 4)).toEqual({
                    collection_center_id: 2, collection_center_name: 'Market Collection Center',
               });
               await expect(collectionCenterSnapshot(trx, 3, 4)).rejects.toThrow('your branch');
               await trx(collectionCentersTable).where({ id: 1 }).update({ active: false });
               await expect(collectionCenterSnapshot(trx, 1, 4)).rejects.toThrow('active collection center');
               expect(north.collection_center_name).toBe('North Collection Center');
          });
     } finally {
          await db.destroy();
     }
});
