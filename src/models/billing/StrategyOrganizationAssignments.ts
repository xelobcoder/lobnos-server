import { z } from 'zod';
import KnexConnection from '../../database/KnexConnections';
export const organizationAssignmentSchema = z.object({ organizationIds: z.array(z.number().int().positive()).min(1).max(1000) });
export async function assignStrategyOrganizations(tenantId: number, strategyId: number, raw: unknown) {
    const ids = [...new Set(organizationAssignmentSchema.parse(raw).organizationIds)];
    const connection = await KnexConnection(tenantId);
    return connection.transaction(async trx => {
        const strategy = await trx('billingstrategy').where({ strategyid: strategyId }).forUpdate().first();
        if (!strategy) throw new Error('Strategy not found.');
        if (Number(strategy.is_expired) === 1 || strategy.valid_until && new Date(strategy.valid_until).getTime() < Date.now()) throw new Error('An expired strategy cannot receive new assignments.');
        const organizations = await trx('organization').whereIn('id', ids).select('id');
        if (organizations.length !== ids.length) throw new Error('One or more organizations no longer exist. No assignments were changed.');
        const existing = await trx('billingstrategy_mapping').where({ strategyid: strategyId, entity_type: 'organization' }).whereIn('entity_id', ids).select('entity_id');
        const added = ids.filter(id => !existing.some(row => Number(row.entity_id) === id));
        if (added.length) await trx('billingstrategy_mapping').insert(added.map(entity_id => ({ strategyid: strategyId, entity_type: 'organization', entity_id }))).onConflict(['strategyid', 'entity_type', 'entity_id']).ignore();
        return { added: added.length, alreadyAssigned: ids.length - added.length };
    });
}
