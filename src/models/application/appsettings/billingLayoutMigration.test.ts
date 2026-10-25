import { expect, it, vi } from 'vitest';
import { up } from '../../../cron/command-line-tool-database/migrations/20261025_billing_layout';

it('adds the default billing layout once without changing existing settings or rows', async () => {
    let exists = false;
    const defaultTo = vi.fn();
    const notNullable = vi.fn(() => ({ defaultTo }));
    const string = vi.fn(() => ({ notNullable }));
    const alterTable = vi.fn(async (_table, callback) => { callback({ string }); exists = true; });
    const connection = { schema: { hasTable: vi.fn().mockResolvedValue(true), hasColumn: vi.fn(async () => exists), alterTable } } as any;
    await up(connection); await up(connection);
    expect(alterTable).toHaveBeenCalledTimes(1); expect(string).toHaveBeenCalledWith('billingLayout', 32); expect(defaultTo).toHaveBeenCalledWith('multi-compact');
});

it('does not create an incomplete application settings table', async () => {
    const alterTable = vi.fn();
    await up({ schema: { hasTable: vi.fn().mockResolvedValue(false), alterTable } } as any);
    expect(alterTable).not.toHaveBeenCalled();
});
