import { describe, expect, it, vi } from 'vitest';
import {
     ClinicianPortalError, ClinicianPortalResultService, describeTestStages, resolveClinicianScope,
} from './ClinicianPortalResultService';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn(async () => { throw new Error('no database in unit tests'); }) }));

const expectError = (fn: () => unknown, statusCode: number) => {
     try { fn(); } catch (error) {
          expect(error).toBeInstanceOf(ClinicianPortalError);
          expect((error as ClinicianPortalError).statusCode).toBe(statusCode);
          return;
     }
     throw new Error('expected an error');
};

describe('resolveClinicianScope', () => {
     it('binds clinician sessions to their own identity', () => {
          expect(resolveClinicianScope({ role: 'clinician', clinicianid: 7, employeeid: 7 }, undefined)).toBe(7);
          expect(resolveClinicianScope({ role: 'Clinician', clinicianid: 7 }, '7')).toBe(7);
          expect(resolveClinicianScope({ role: 'clinician', employeeid: 9 }, '')).toBe(9);
     });

     it('refuses a clinician asking for another clinician', () => {
          expectError(() => resolveClinicianScope({ role: 'clinician', clinicianid: 7 }, '8'), 403);
     });

     it.each(['patient', 'organization', 'outsourced', 'nurse', 'scientist', 'doctor', ''])('refuses external or role-less sessions: %s', role => {
          expectError(() => resolveClinicianScope({ role, employeeid: 7 }, '7'), 403);
     });

     it('requires authentication', () => {
          expectError(() => resolveClinicianScope(null, '7'), 401);
          expectError(() => resolveClinicianScope({ role: 'clinician' }, undefined), 401);
     });

     it('lets staff preview only an explicitly named clinician', () => {
          expect(resolveClinicianScope({ role: 'admin', employeeid: 1 }, '12')).toBe(12);
          expectError(() => resolveClinicianScope({ role: 'admin', employeeid: 1 }, undefined), 400);
     });

     it.each(['0', '-1', '7abc', '1.5', '99999999999999999999'])('rejects malformed clinician ids: %s', value => {
          expectError(() => resolveClinicianScope({ role: 'clinician', clinicianid: 7 }, value), 400);
     });
});

const stage = (overrides: Record<string, unknown> = {}) => ({
     ascension_id: 100, testid: 5, serviceid: 50, test_name: 'FBC', ascension_date: '2026-10-01T08:00:00Z',
     collectionStartDate: '2026-10-01T08:10:00Z', collectionEndDate: '2026-10-01T08:15:00Z',
     processingStartDate: '2026-10-01T09:00:00Z', processingEndDate: '2026-10-01T09:30:00Z',
     resultEntryStart: '2026-10-01T10:00:00Z', resultEntryEnd: '2026-10-01T10:05:00Z',
     isapproved: 1, approvedBy: '3', minvalidation: 1, lastupdatedon: '2026-10-01T11:00:00Z',
     workflow: { collection: 'completed', sampleValidation: 'bypassed', processing: 'completed' },
     ...overrides,
});

const fakeConnection = () => {
     const builder: any = {
          join: () => builder, where: () => builder, select: () => builder,
          first: async () => ({ patientid: 21, firstname: 'Ama' }),
     };
     return vi.fn(async () => ((() => builder) as any));
};

const makeService = (owned: { serviceid: number; patientid: number }[], stages: any[]) => {
     const deps = {
          connection: fakeConnection(),
          findOwnedServices: vi.fn(async () => owned),
          loadStages: vi.fn(async () => stages),
          loadReport: vi.fn(async () => ({ records: [{ name: 'Hb', value: '13', units: 'g/dL', lowerlimit: 12, upperlimit: 16 }], validators: [] } as any)),
     };
     return { deps, service: new ClinicianPortalResultService(4, deps) };
};

describe('ClinicianPortalResultService.getRequestResults authorization', () => {
     it('returns 404 and loads nothing when the clinician has no services on the bill', async () => {
          const { deps, service } = makeService([], [stage()]);
          await expect(service.getRequestResults(7, 900)).rejects.toMatchObject({ statusCode: 404 });
          expect(deps.findOwnedServices).toHaveBeenCalledWith(7, 900);
          expect(deps.loadStages).not.toHaveBeenCalled();
          expect(deps.loadReport).not.toHaveBeenCalled();
     });

     it('only exposes tests ordered by the clinician, never other clinicians on the same bill', async () => {
          const { deps, service } = makeService([{ serviceid: 50, patientid: 21 }], [
               stage(), stage({ ascension_id: 101, serviceid: 51, testid: 6, test_name: 'Lipid profile' }),
          ]);
          const result = await service.getRequestResults(7, 900);
          expect(result.tests.map(test => test.ascensionid)).toEqual([100]);
          expect(deps.loadReport).toHaveBeenCalledTimes(1);
          expect(deps.loadReport).toHaveBeenCalledWith(21, 900, 5, 100);
     });

     it('loads results only for approved tests and dedupes repeated stage rows', async () => {
          const { deps, service } = makeService([{ serviceid: 50, patientid: 21 }, { serviceid: 52, patientid: 21 }], [
               stage(), stage(),
               stage({ ascension_id: 102, serviceid: 52, testid: 8, isapproved: 0, approvedBy: '', resultEntryEnd: null }),
          ]);
          const result = await service.getRequestResults(7, 900);
          expect(result.tests).toHaveLength(2);
          expect(result.tests.find(test => test.ascensionid === 102)?.approved).toBe(false);
          expect(deps.loadReport).toHaveBeenCalledTimes(1);
          expect(result.reports).toHaveLength(1);
          expect(result.reports[0].records[0]).toMatchObject({ name: 'Hb', value: '13', units: 'g/dL' });
     });

     it('does not treat entered-but-unvalidated results as approved', () => {
          const described = describeTestStages(stage({ isapproved: 0, approvedBy: '', minvalidation: 2 }));
          expect(described.approved).toBe(false);
          expect(described.timeline.find(step => step.key === 'validation')?.status).toBe('in_progress');
     });
});
