import { describe, expect, it, vi } from 'vitest';
const connection = vi.hoisted(() => vi.fn());
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn(async () => connection) }));
import { Packages } from './Billlingpackages';
describe('package pagination totals', () => {
    it.each([0, 4])('counts packages separately from the grouped assignments (%i packages)', async total => {
        const grouped: any = {};
        for (const method of ['select', 'leftJoin', 'groupBy', 'where', 'orderBy', 'limit', 'offset']) grouped[method] = vi.fn(() => grouped);
        grouped.then = (resolve: any) => resolve([]);
        const count: any = { where: vi.fn(() => count), count: vi.fn(() => count), first: vi.fn(async () => ({ count: total })) };
        connection.mockReset().mockReturnValueOnce(grouped).mockReturnValueOnce(count);
        (connection as any).raw = vi.fn();
        const result = await Packages.getPackagesWithPagination(1, { page: 1, limit: 10, search: 'wellness' });
        expect(result).toMatchObject({ data: [], total, page: 1, totalPages: total ? 1 : 0 });
        expect(count.count).toHaveBeenCalledWith('id as count');
        expect(count.where).toHaveBeenCalledWith('packages.package_name', 'like', '%wellness%');
    });
});
