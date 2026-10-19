import { describe, expect, it, vi } from 'vitest';
import knex from 'knex';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn(), KnexConnection: vi.fn() }));

import { applyEntityOrderFilters } from '../../models/entityorders/EntityOrderRepository';
import { buildEntityOrderListFilters } from './entityOrdersHandlers';

const db = knex({ client: 'mysql2' });

describe('buildEntityOrderListFilters', () => {
     it('accepts a valid date range and status', () => {
          const result = buildEntityOrderListFilters({ from: '2025-01-01', to: '2025-01-31', status: 'CANCELLED' }, { role: 'admin', employeeid: 1 });
          expect('filters' in result && result.filters).toMatchObject({ from: '2025-01-01', to: '2025-01-31', status: 'CANCELLED' });
     });

     it('rejects malformed or reversed dates and unknown statuses', () => {
          expect('error' in buildEntityOrderListFilters({ from: '01/01/2025' }, { role: 'admin' })).toBe(true);
          expect('error' in buildEntityOrderListFilters({ from: '2025-02-01', to: '2025-01-01' }, { role: 'admin' })).toBe(true);
          expect('error' in buildEntityOrderListFilters({ status: 'BOGUS' }, { role: 'admin' })).toBe(true);
     });

     it('pins clinician sessions to their own orders regardless of query', () => {
          const result = buildEntityOrderListFilters(
               { clinicianId: '99', entityType: 'organization', entityId: '5' },
               { role: 'clinician', clinicianid: 7, employeeid: 7 }
          );
          expect('filters' in result).toBe(true);
          if ('filters' in result) {
               expect(result.filters.clinicianId).toBe(7);
               expect(result.filters.entityType).toBeUndefined();
               expect(result.filters.entityId).toBeUndefined();
          }
     });
});

describe('applyEntityOrderFilters', () => {
     it('matches clinician entity or orderer and filters by created date', () => {
          const q = applyEntityOrderFilters(db('entity_orders as o').select('o.id'), { clinicianId: 7, from: '2025-01-01', to: '2025-01-31' });
          const { sql, bindings } = q.toSQL();
          expect(sql).toContain('((`o`.`entity_type` = ? and `o`.`entity_id` = ?) or `o`.`ordered_by_employee_id` = ?)');
          expect(sql).toContain('DATE(o.created_at) BETWEEN ? AND ?');
          expect(bindings).toEqual(['clinician', 7, 7, '2025-01-01', '2025-01-31']);
     });

     it('supports open-ended ranges', () => {
          const { sql, bindings } = applyEntityOrderFilters(db('entity_orders as o'), { from: '2025-03-01' }).toSQL();
          expect(sql).toContain('DATE(o.created_at) >= ?');
          expect(bindings).toEqual(['2025-03-01']);
     });
});
