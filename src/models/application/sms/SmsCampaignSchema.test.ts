import { describe, expect, it, vi } from 'vitest';
import { ensureSmsCampaignSchema } from './SmsCampaignSchema';

describe('upgrading an existing SMS queue', () => {
    it.each([false, true])('repairs a missing review hash and remains idempotent (exists=%s)', async exists => {
        const nullable = vi.fn();
        const string = vi.fn(() => ({ nullable }));
        const alterTable = vi.fn(async (_name, callback) => callback({ string }));
        const db = { schema: {
            hasTable: vi.fn(async name => !['primesmsjobs', 'primesmsjobrecipients'].includes(name)),
            hasColumn: vi.fn(async () => exists), alterTable,
        } };
        await ensureSmsCampaignSchema(db as any);
        expect(alterTable).toHaveBeenCalledTimes(exists ? 0 : 1);
        if (!exists) {
            expect(alterTable).toHaveBeenCalledWith('sms_campaign_dispatch', expect.any(Function));
            expect(string).toHaveBeenCalledWith('review_hash', 64);
            expect(nullable).toHaveBeenCalled();
        }
    });
});
