import { describe, it, expect, vi } from 'vitest';
import knex from 'knex';
const state = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../../../database/KnexConnections', () => ({ default: async () => state.db }));
import { CommissionAnalyticsWithDate } from './CommissionAnalyticsWithDate';

describe('commission analytics query contracts', () => {
    it('filters every dashboard section by recorded organization and includes the full end day', async () => {
        const client = knex({ client: 'mysql2' });
        const queries: any[] = [];
        state.db = Object.assign((table: any) => client(table), {
            raw: client.raw.bind(client),
            from: (source: any) => {
                const query = client.from(source);
                query.then = (resolve: any, reject: any) => {
                    queries.push(query.toSQL());
                    return Promise.resolve([]).then(resolve, reject);
                };
                return query;
            }
        });
        const repo = new CommissionAnalyticsWithDate(1);
        const filters = { tenantId: 1, startDate: new Date('2026-10-01'), endDate: new Date('2026-11-12'), period: 'quarterly' as const, recipientType: 'organization' as const };
        await repo.getCommissionsByPeriod(filters);
        await repo.getPeriodStatistics(filters);
        await repo.getCommissionsByStatus(filters);
        await repo.getRecipientPaymentEfficiency(filters);
        expect(queries).toHaveLength(4);
        for (const query of queries) {
            expect(query.sql).toContain('recipient_type');
            expect(query.bindings).toContain('organization');
            expect(query.sql).toContain('INTERVAL 1 DAY');
            expect(query.sql).toContain('FROM commission_tracking');
            expect(query.sql).toContain('FROM expense_payment_reversals');
            expect(query.sql).toContain('p.payment_date');
        }
        expect(queries[0].sql).toContain('QUARTER(');
        expect(queries[1].sql).toContain('DISTINCT recipient_type, recipient_id');
        await client.destroy();
    });
});
