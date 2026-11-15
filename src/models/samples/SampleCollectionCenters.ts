import type { Knex } from 'knex';

export const collectionCentersTable = 'sample_collection_centers';

export async function collectionCenterSnapshot(db: Knex, centerId: unknown, branchId: number | null | undefined) {
     if (centerId == null) return {};
     if (typeof centerId !== 'number' || !Number.isSafeInteger(centerId) || centerId < 1 || !branchId) {
          throw new Error('Select a valid collection center for your branch');
     }
     const center = await db(collectionCentersTable).where({ id: centerId, branch_id: branchId, active: true })
          .forUpdate().first('id', 'name');
     if (!center) throw new Error('Choose an active collection center in your branch');
     return { collection_center_id: Number(center.id), collection_center_name: String(center.name) };
}
