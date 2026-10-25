import { describe, expect, it, vi } from 'vitest';
import knex from 'knex';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn(), KnexConnection: vi.fn() }));

import { parseDateRange } from './PrescriptionController';
import { applyPrescriptionScopeFilters } from '../../models/prescriptions/repositories/PrescriptionRepository';

const db = knex({ client: 'mysql2' });

describe('prescription date range', () => {
     it('parses valid ranges and leaves missing bounds undefined', () => {
          expect(parseDateRange({ from: '2025-01-01', to: '2025-01-31' })).toEqual({ from: '2025-01-01', to: '2025-01-31' });
          expect(parseDateRange({})).toEqual({ from: undefined, to: undefined });
     });

     it('rejects bad formats and reversed ranges', () => {
          expect(parseDateRange({ from: '2025-1-1' }).error).toBeDefined();
          expect(parseDateRange({ from: '2025-02-01', to: '2025-01-01' }).error).toBeDefined();
     });

     it('scopes the query by clinician and created date', () => {
          const { sql, bindings } = applyPrescriptionScopeFilters(db('prescriptions as p').select('p.id') as any, {
               clinicianId: 4,
               from: '2025-01-01',
               to: '2025-01-31',
          }).toSQL();
          expect(sql).toContain('`p`.`clinician_id` = ?');
          expect(sql).toContain('DATE(p.created_at) BETWEEN ? AND ?');
          expect(bindings).toEqual(['practitioner', 4, 4, '2025-01-01', '2025-01-31']);
          expect(sql).toContain('practitioner_access');
     });
});
