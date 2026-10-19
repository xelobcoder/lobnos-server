import { describe, expect, it, vi } from 'vitest';
import knex from 'knex';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn(), KnexConnection: vi.fn() }));

import { parseClinicianCommissionRequest } from './ClinicianCommissionPortalController';
import { clinicianCommissionBaseQuery, resolveSeriesPeriod } from '../../models/commissions/ClinicianCommissionPortalRepository';

const db = knex({ client: 'mysql2' });

describe('parseClinicianCommissionRequest', () => {
     it('lets a clinician read only their own commission', () => {
          const own = parseClinicianCommissionRequest({ clinicianId: '7' }, { startDate: '2025-01-01', endDate: '2025-01-31' }, { role: 'clinician', clinicianid: 7 });
          expect('scope' in own && own.scope).toEqual({ clinicianId: 7, from: '2025-01-01', to: '2025-01-31' });

          const other = parseClinicianCommissionRequest({ clinicianId: '8' }, {}, { role: 'clinician', clinicianid: 7 });
          expect('error' in other && other.error.status).toBe(403);
     });

     it('refuses patient sessions and validates input', () => {
          expect((parseClinicianCommissionRequest({ clinicianId: '7' }, {}, { role: 'patient' }) as any).error.status).toBe(403);
          expect((parseClinicianCommissionRequest({ clinicianId: 'x' }, {}, { role: 'admin' }) as any).error.status).toBe(400);
          expect((parseClinicianCommissionRequest({ clinicianId: '7' }, { startDate: '2025-02-01', endDate: '2025-01-01' }, { role: 'admin' }) as any).error.status).toBe(400);
     });

     it('clamps pagination', () => {
          const parsed = parseClinicianCommissionRequest({ clinicianId: '7' }, { page: '-3', count: '5000' }, { role: 'admin' }) as any;
          expect(parsed.page).toBe(1);
          expect(parsed.count).toBe(200);
     });
});

describe('clinician commission query', () => {
     it('reads tracked commission for the clinician only, within the service date range', () => {
          const { sql, bindings } = clinicianCommissionBaseQuery(db, { clinicianId: 7, from: '2025-01-01', to: '2025-01-31' }).select('ct.id').toSQL();
          expect(sql).toContain('`ct`.`recipient_type` = ?');
          expect(sql).toContain('`ct`.`recipient_id` = ?');
          expect(sql).toContain('DATE(ds.serviceAddedOn) BETWEEN ? AND ?');
          expect(bindings).toEqual(expect.arrayContaining(['clinician', 7, 'CLINICIAN_SPECIAL_BILLING', 'ORGANIZATION', '2025-01-01', '2025-01-31']));
     });

     it('picks a chart granularity from the range', () => {
          expect(resolveSeriesPeriod('2025-01-01', '2025-01-31')).toBe('daily');
          expect(resolveSeriesPeriod('2025-01-01', '2025-03-31')).toBe('weekly');
          expect(resolveSeriesPeriod('2025-01-01', '2025-12-31')).toBe('monthly');
          expect(resolveSeriesPeriod('2020-01-01', '2025-12-31')).toBe('yearly');
          expect(resolveSeriesPeriod('2025-01-01', '2025-01-31', 'monthly')).toBe('monthly');
     });
});
