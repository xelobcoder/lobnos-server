import { describe, expect, it, vi } from 'vitest';
import { up } from '../../cron/command-line-tool-database/migrations/20261021_patient_portal_engagement';

describe('existing patient notification schema upgrades', () => {
    it('adds retry tracking to an existing table without modifying its records and is repeatable', async () => {
        let hasAttempts = false;
        const defaults = vi.fn(() => { hasAttempts = true; });
        const builder: any = { unsigned: () => builder, notNullable: () => builder, defaultTo: defaults };
        const integer = vi.fn((name: string) => { expect(name).toBe('attempts'); return builder; });
        const db: any = vi.fn(() => { throw new Error('Existing business rows must be retained'); });
        db.schema = { hasTable: vi.fn(async () => true),
            hasColumn: vi.fn(async (table: string, column: string) => table !== 'patient_portal_notifications' || column !== 'attempts' || hasAttempts),
            alterTable: vi.fn(async (table: string, change: any) => { expect(table).toBe('patient_portal_notifications'); change({ integer }); }),
        };
        await up(db); await up(db);
        expect(db.schema.alterTable).toHaveBeenCalledTimes(1);
        expect(defaults).toHaveBeenCalledWith(1);
        expect(db).not.toHaveBeenCalled();
    });
});
