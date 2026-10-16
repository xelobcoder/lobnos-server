import { beforeEach, describe, expect, it, vi } from 'vitest';

const knexMock: any = vi.hoisted(() => ({ schema: { hasTable: vi.fn(), createTable: vi.fn() } }));

vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn(async () => knexMock) }));
vi.mock('../../../utils/encryptionModels', () => ({
     encrypt_value: (v: string) => (v ? `enc(${v})` : ''),
     decrypt_value: (v: string) => {
          if (!v.startsWith('enc(')) throw new Error('bad ciphertext');
          return v.slice(4, -1);
     },
}));

import ImagingResultAuditRepository, {
     IMAGING_AUDIT_TABLE, imagingDepartmentCondition, resolveActorEmployeeId,
} from './ImagingResultAuditRepository';
import ImagingAnalyticsController, { ImagingAuditController, validateDateRange } from '../../../controllers/operations/ImagingAnalyticsController';

const mockRes = () => {
     const res: any = {};
     res.status = vi.fn(() => res);
     res.json = vi.fn(() => res);
     return res;
};

describe('ImagingResultAuditRepository', () => {
     beforeEach(() => {
          ImagingResultAuditRepository.resetEnsureCache();
          knexMock.schema.hasTable.mockReset();
          knexMock.schema.createTable.mockReset();
     });

     it('diffFields reports creates and updates and skips unchanged/empty fields', () => {
          const changes = ImagingResultAuditRepository.diffFields(
               { '1': 'Normal liver', '2': 'same' },
               { '1': 'Fatty liver', '2': 'same', '3': 'New finding', '4': '' }
          );
          expect(changes).toEqual([
               { fieldName: '1', action: 'UPDATE', oldValue: 'Normal liver', newValue: 'Fatty liver' },
               { fieldName: '3', action: 'CREATE', oldValue: null, newValue: 'New finding' },
          ]);
     });

     it('ensureTable is idempotent: creates once, then is cached', async () => {
          knexMock.schema.hasTable.mockResolvedValue(false);
          knexMock.schema.createTable.mockResolvedValue(undefined);
          await ImagingResultAuditRepository.ensureTable(7);
          await ImagingResultAuditRepository.ensureTable(7);
          expect(knexMock.schema.createTable).toHaveBeenCalledTimes(1);
          expect(knexMock.schema.createTable.mock.calls[0][0]).toBe(IMAGING_AUDIT_TABLE);
     });

     it('ensureTable skips creation when the table exists and tolerates a create race', async () => {
          knexMock.schema.hasTable.mockResolvedValueOnce(true);
          await ImagingResultAuditRepository.ensureTable(1);
          expect(knexMock.schema.createTable).not.toHaveBeenCalled();

          knexMock.schema.hasTable.mockResolvedValueOnce(false);
          knexMock.schema.createTable.mockRejectedValueOnce({ code: 'ER_TABLE_EXISTS_ERROR' });
          await expect(ImagingResultAuditRepository.ensureTable(2)).resolves.toBeUndefined();
     });

     it('record encrypts old/new values and inserts through the supplied transaction', async () => {
          const insert = vi.fn().mockResolvedValue([1]);
          const trx: any = vi.fn(() => ({ insert }));
          await ImagingResultAuditRepository.record(trx, [{
               ascensionid: 5, testid: 9, entityType: 'RESULT_FIELD', entityId: 12, action: 'UPDATE',
               fieldName: 'Findings', oldValue: 'A', newValue: 'B', employeeid: 3,
          }]);
          expect(trx).toHaveBeenCalledWith(IMAGING_AUDIT_TABLE);
          const row = insert.mock.calls[0][0][0];
          expect(row).toMatchObject({ ascensionid: 5, action: 'UPDATE', old_value: 'enc(A)', new_value: 'enc(B)', employeeid: 3, entity_id: '12' });
          await ImagingResultAuditRepository.record(trx, []);
          expect(insert).toHaveBeenCalledTimes(1);
     });

     it('decryptStoredValue falls back to legacy plain values', () => {
          expect(ImagingResultAuditRepository.decryptStoredValue('enc(x)')).toBe('x');
          expect(ImagingResultAuditRepository.decryptStoredValue('plain')).toBe('plain');
          expect(ImagingResultAuditRepository.decryptStoredValue(null)).toBe('');
     });

     it('imagingDepartmentCondition binds one LIKE per keyword', () => {
          const { sql, bindings } = imagingDepartmentCondition('dp.department');
          expect(sql.match(/\?/g)?.length).toBe(bindings.length);
          expect(bindings).toContain('%ultrasound%');
     });

     it('resolveActorEmployeeId prefers the token user over client input', () => {
          expect(resolveActorEmployeeId({ authUser: { employeeid: 4 }, query: { employeeid: '9' } })).toBe(4);
          expect(resolveActorEmployeeId({ query: { employeeid: '9' } })).toBe(9);
          expect(resolveActorEmployeeId({ body: { employeeid: 'abc' } })).toBeNull();
     });
});

describe('imaging controllers', () => {
     it('validateDateRange enforces format, order and size', () => {
          expect(validateDateRange('2026-01-01', '2026-01-31')).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
          expect(validateDateRange('2026-02-30', '2026-03-01')).toMatchObject({ code: 'INVALID_DATE_FORMAT' });
          expect(validateDateRange(undefined, '2026-03-01')).toMatchObject({ code: 'INVALID_DATE_FORMAT' });
          expect(validateDateRange('2026-03-02', '2026-03-01')).toMatchObject({ code: 'INVALID_DATE_RANGE' });
          expect(validateDateRange('2020-01-01', '2026-03-01')).toMatchObject({ code: 'DATE_RANGE_TOO_LARGE' });
     });

     it('analytics rejects a missing tenantId and bad dates with 400', async () => {
          const res = mockRes();
          await ImagingAnalyticsController.getImagingAnalytics({ query: { startDate: '2026-01-01', endDate: '2026-01-02' } } as any, res);
          expect(res.status).toHaveBeenCalledWith(400);
          const res2 = mockRes();
          await ImagingAnalyticsController.getImagingAnalytics({ query: { tenantId: '1', startDate: 'x', endDate: 'y' } } as any, res2);
          expect(res2.status).toHaveBeenCalledWith(400);
     });

     it('audit endpoint is admin-only and validates filters', async () => {
          const next = vi.fn();
          const denied = mockRes();
          ImagingAuditController.requireAdmin({ authUser: { role: 'sonographer' } } as any, denied, next);
          expect(denied.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
          ImagingAuditController.requireAdmin({ authUser: { role: 'Super_Admin' } } as any, mockRes(), next);
          expect(next).toHaveBeenCalledTimes(1);

          const bad = mockRes();
          await ImagingAuditController.list({ query: { tenantId: '1', action: 'EXPLODE' } } as any, bad);
          expect(bad.status).toHaveBeenCalledWith(400);
          const badPage = mockRes();
          await ImagingAuditController.list({ query: { tenantId: '1', page: '0' } } as any, badPage);
          expect(badPage.status).toHaveBeenCalledWith(400);
     });
});
