import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), workflow: vi.fn() }));
vi.mock('../../hooks/helper', () => ({ promisifyQuery: mocks.query, rowAffected: vi.fn(), paginationQuery: vi.fn() }));
vi.mock('./LaboratoryWorkflow', () => ({ LaboratoryWorkflowService: class { forAscensions = mocks.workflow; } }));
vi.mock('./testApprovalClass', () => ({ TestApprovalClass: class {} }));
vi.mock('./imaging/ImagingResultAuditRepository', () => ({ default: class {} }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../application/appsettings/appset', () => ({ default: class {} }));
import Operations from './operations';

describe('visit overview service payment eligibility', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.workflow.mockImplementation(async rows => rows); });
    it.each(['paid', 'partial', 'unpaid'])('returns the persisted %s service status with tenant-scoped workflow data', async paymentstatus => {
        const row = { ascension_id: 171, serviceid: 45, billingid: 67, paymentstatus };
        mocks.query.mockResolvedValue([row]);
        const result = await Operations.getAscensionOverViewModelTransaction(309027, 67);
        const [tenant, sql, params] = mocks.query.mock.calls[0];
        expect(tenant).toBe(309027);
        expect(params).toEqual([67]);
        expect(sql).toMatch(/trx\.paymentstatus/);
        expect(sql).toContain('ra.requires_revalidation,');
        expect(sql.indexOf("WHEN ra.requires_revalidation = 1")).toBeLessThan(sql.indexOf("WHEN ra.isapproved = 1"));
        expect(sql).toContain('trx.serviceid = ta.serviceid');
        expect(result).toEqual([row]);
    });
});
