import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ review: vi.fn() }));
vi.mock('../../models/billing/ModernBillingPreview', () => ({ ModernBillingPreview: class { review = state.review; } }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: request => request.authUser || null }));
import { previewModernBilling } from './ModernBillingController';
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as any;
beforeEach(() => { vi.clearAllMocks(); });
it('requires authentication and an assigned branch before invoking pricing', async () => {
    for (const actor of [undefined, { branch: null }]) {
        const res = response(); await previewModernBilling({ authUser: actor } as any, res);
        expect(res.status).toHaveBeenCalledWith(actor ? 403 : 401);
    }
    expect(state.review).not.toHaveBeenCalled();
});
it('uses the authenticated actor rather than client tenancy, branch or employee values', async () => {
    const actor = { tenantId: 3, branch: 4, employeeid: 7 }; const body = { tenantId: 99, employeeid: 99 };
    state.review.mockResolvedValue({ amountPayable: 100 }); const res = response();
    await previewModernBilling({ authUser: actor, body, query: { tenantId: 99 } } as any, res);
    expect(state.review).toHaveBeenCalledWith(actor, body); expect(res.json).toHaveBeenCalledWith({ success: true, data: { amountPayable: 100 } });
});
it('returns a recoverable validation error without creating a billing record', async () => {
    state.review.mockRejectedValue(new Error('Choose an outsourcing organization')); const res = response();
    await previewModernBilling({ authUser: { branch: 4 }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Choose an outsourcing organization' });
});
