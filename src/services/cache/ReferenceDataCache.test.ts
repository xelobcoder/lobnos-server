import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     query: vi.fn(),
     pagination: vi.fn(),
     connection: vi.fn(),
     branchLoad: vi.fn(async (_tenant: number, _view: string, _parameters: Record<string, unknown>, loader: () => Promise<unknown>) => loader()),
     departmentLoad: vi.fn(async (_tenant: number, _view: string, _parameters: Record<string, unknown>, loader: () => Promise<unknown>) => loader()),
     companyLoad: vi.fn(async (_tenant: number, _view: string, _parameters: Record<string, unknown>, loader: () => Promise<unknown>) => loader()),
     branchInvalidate: vi.fn(async (_tenant: number) => undefined),
     panelInvalidate: vi.fn(async (_tenant: number) => undefined),
     companyInvalidate: vi.fn(async (_tenant: number) => undefined),
}));

vi.mock('../../hooks/helper', () => ({
     promisifyQuery: (...args: unknown[]) => mocks.query(...args),
     paginationQuery: (...args: unknown[]) => mocks.pagination(...args),
     rowAffected: (value: { affectedRows: number }) => value.affectedRows > 0,
}));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('../../database/KnexConnections', () => ({ default: () => mocks.connection() }));
vi.mock('../../models/application/appsettings/appset', () => ({ default: class {} }));
vi.mock('./testPanelCache', () => ({
     branchCache: { getOrLoad: mocks.branchLoad, invalidate: mocks.branchInvalidate },
     departmentCache: { getOrLoad: mocks.departmentLoad },
     testPanelCache: { invalidate: mocks.panelInvalidate },
     companyInfoCache: { getOrLoad: mocks.companyLoad, invalidate: mocks.companyInvalidate },
}));

import Branch from '../../models/application/branches/branches';
import { DepartmentLims } from '../../models/settings/departmentLims';
import { getAllCompanyProfiles, insertCompanyProfile, truncateCompanyProfile, companyInfo } from '../../models/settings/companyProfile';

beforeEach(() => {
     vi.clearAllMocks();
     mocks.query.mockReset();
     mocks.branchInvalidate.mockImplementation(async () => undefined);
     mocks.companyInvalidate.mockImplementation(async () => undefined);
});

describe('branch caching', () => {
     it('caches pagination and branch-ID variants without changing results', async () => {
          const rows = [{ branchid: 7, name: 'Main' }];
          mocks.pagination.mockResolvedValue(rows);
          mocks.query.mockResolvedValue(rows);
          expect(await Branch.getBranch(12, 20, 2)).toBe(rows);
          expect(await Branch.getBranch(12, 10, 1, 7)).toBe(rows);
          expect(mocks.branchLoad).toHaveBeenNthCalledWith(1, 12, 'branch-list', { count: 20, page: 2 }, expect.any(Function));
          expect(mocks.branchLoad).toHaveBeenNthCalledWith(2, 12, 'branch-by-id', { branchid: 7 }, expect.any(Function));
          expect(mocks.pagination).toHaveBeenCalledWith({ count: 20, page: 2 }, expect.any(String), [], 12);
     });

     it('invalidates all branch mutations, including activation and deactivation', async () => {
          mocks.query.mockResolvedValue({ affectedRows: 1 });
          await Branch.addBranch(12, 'New', 'Address', 'lab@example.test', '123', 1);
          await Branch.editBranch(12, 7, 'Edited', '123', 'Address', 'lab@example.test', 1);
          await Branch.deleteBranch(12, 7);
          await Branch.activateDeactivateBranch(12, 7, 1);
          await Branch.activateDeactivateBranch(12, 7, 0);
          expect(mocks.branchInvalidate).toHaveBeenCalledTimes(5);
          expect(mocks.branchInvalidate).toHaveBeenCalledWith(12);
     });

     it('does not invalidate no-op or failed writes', async () => {
          mocks.query.mockResolvedValueOnce({ affectedRows: 0 }).mockRejectedValueOnce(new Error('DB failed'));
          expect(await Branch.deleteBranch(12, 7)).toBe(false);
          await expect(Branch.editBranch(12, 7, 'New', '', '', '', 1)).rejects.toThrow('DB failed');
          expect(mocks.branchInvalidate).not.toHaveBeenCalled();
     });

     it('waits for invalidation before resolving a write', async () => {
          const order: string[] = [];
          mocks.query.mockImplementation(async () => { order.push('write'); return { affectedRows: 1 }; });
          mocks.branchInvalidate.mockImplementation(async () => { order.push('invalidate'); });
          await Branch.deleteBranch(12, 7);
          order.push('return');
          expect(order).toEqual(['write', 'invalidate', 'return']);
     });

     it('keeps internal branch lookups uncached', async () => {
          const row = { branchid: 7 };
          mocks.query.mockResolvedValue([row]);
          expect(await Branch.find(12, 7)).toBe(row);
          expect(mocks.branchLoad).not.toHaveBeenCalled();
     });
});

describe('department caching', () => {
     it('caches both list and detail results with unchanged empty-result semantics', async () => {
          const rows = [{ id: 2, department: 'Chemistry' }];
          mocks.query.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
          expect(await new DepartmentLims(1).getDepartments(12)).toBe(rows);
          expect(await new DepartmentLims(2).getSpecificDepartment(12)).toBe(rows[0]);
          expect(await new DepartmentLims(3).getSpecificDepartment(12)).toBeNull();
          expect(mocks.departmentLoad).toHaveBeenNthCalledWith(1, 12, 'department-list', {}, expect.any(Function));
          expect(mocks.departmentLoad).toHaveBeenNthCalledWith(2, 12, 'department-by-id', { id: 2 }, expect.any(Function));
          expect(mocks.departmentLoad).toHaveBeenNthCalledWith(3, 12, 'department-by-id', { id: 3 }, expect.any(Function));
     });

     it('invalidates the shared department/test-panel generation for all writes', async () => {
          mocks.query.mockResolvedValue({ affectedRows: 1 });
          const department = new DepartmentLims(2);
          const body = { id: 2, department: 'Chemistry', departmentManager: 'Manager', employeeid: 1 };
          await department.addNewDepartment(12, body);
          await department.updateDepartment(12, body);
          await department.deleteDepartment(12);
          expect(mocks.panelInvalidate).toHaveBeenCalledTimes(3);
          expect(mocks.panelInvalidate).toHaveBeenCalledWith(12);
     });

     it('does not invalidate when no department changed', async () => {
          mocks.query.mockResolvedValue({ affectedRows: 0 });
          expect(await new DepartmentLims(2).deleteDepartment(12)).toBe(false);
          expect(mocks.panelInvalidate).not.toHaveBeenCalled();
     });
});

describe('company information caching', () => {
     const profile: companyInfo = {
          name: 'Lab', email: 'lab@example.test', motto: 'Quality', phonenumber: '123',
          address: 'Address', website: '', street: '', alternativenumber: '',
     };

     function database(insertFails = false) {
          const order: string[] = [];
          const builder = {
               count: vi.fn().mockReturnThis(),
               first: vi.fn(async () => ({ count: 1 })),
               del: vi.fn(async () => { order.push('delete'); return 1; }),
               insert: vi.fn(async () => {
                    order.push('insert');
                    if (insertFails) throw new Error('Insert failed');
                    return [1];
               }),
          };
          const trx = vi.fn(() => builder);
          mocks.connection.mockResolvedValue({
               transaction: async (work: (transaction: typeof trx) => Promise<boolean>) => {
                    try {
                         const result = await work(trx);
                         order.push('commit');
                         return result;
                    } catch (error) {
                         order.push('rollback');
                         throw error;
                    }
               },
          });
          return { order, builder };
     }

     it('caches profiles and null without altering their shape', async () => {
          mocks.query.mockResolvedValueOnce([profile]).mockResolvedValueOnce([]);
          expect(await getAllCompanyProfiles(12)).toBe(profile);
          expect(await getAllCompanyProfiles(13)).toBeNull();
          expect(mocks.companyLoad).toHaveBeenCalledWith(12, 'company-profile', {}, expect.any(Function));
          expect(mocks.companyLoad).toHaveBeenCalledWith(13, 'company-profile', {}, expect.any(Function));
     });

     it('replaces the profile transactionally and invalidates only after commit', async () => {
          const { order } = database();
          mocks.companyInvalidate.mockImplementation(async () => { order.push('invalidate'); });
          expect(await insertCompanyProfile(12, profile)).toBe(true);
          expect(order).toEqual(['delete', 'insert', 'commit', 'invalidate']);
          expect(mocks.companyInvalidate).toHaveBeenCalledWith(12);
     });

     it('preserves the existing generation when replacement rolls back', async () => {
          const { order } = database(true);
          await expect(insertCompanyProfile(12, profile)).rejects.toThrow('Insert failed');
          expect(order).toEqual(['delete', 'insert', 'rollback']);
          expect(mocks.companyInvalidate).not.toHaveBeenCalled();
     });

     it('invalidates explicit profile clearing but not failed clearing', async () => {
          mocks.query.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Truncate failed'));
          await truncateCompanyProfile(12);
          expect(mocks.companyInvalidate).toHaveBeenCalledWith(12);
          await expect(truncateCompanyProfile(12)).rejects.toThrow('Truncate failed');
          expect(mocks.companyInvalidate).toHaveBeenCalledTimes(1);
     });
});
