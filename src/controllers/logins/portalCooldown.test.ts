import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), access: { enabled: 1, staff_employeeid: null as number | null } }));
vi.mock('../../models/auth/PractitionerLoginSecurity', () => ({ verifyPractitionerCredentials: mocks.verify }));
vi.mock('../../models/consultation/ConsultationSchema', () => ({ consultationDb: async () => (table: string) => {
    const query: any = {
        leftJoin: () => query, select: () => query, where: () => query,
        first: async () => table === 'practitioner_access' ? mocks.access : { clinicianid: 7, password: 'synthetic' },
    };
    return query;
} }));
import { LoginCooldownError } from '../../models/auth/LoginAttemptSecurity';
import { authenticateClinicianPortal } from './authHandlers';
beforeEach(() => { vi.clearAllMocks(); mocks.access = { enabled: 1, staff_employeeid: null }; });
describe('practitioner login cooldown response', () => {
    const request = { query: { tenantId: 4 }, body: { username: 'C007', password: 'wrong' } };
    function response() { return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() }; }
    it('returns the shared 429 contract before creating a portal session', async () => {
        mocks.verify.mockRejectedValue(new LoginCooldownError(300));
        const res = response();
        await authenticateClinicianPortal(request as any, res as any);
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '300');
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LOGIN_COOLDOWN', retryAfter: 300 }));
        expect(res.send).not.toHaveBeenCalled();
    });
    it.each([{ enabled: 0, staff_employeeid: null }, { enabled: 1, staff_employeeid: 20 }])('keeps disabled and linked staff accounts out of external login', async access => {
        mocks.access = access;
        const res = response();
        await authenticateClinicianPortal(request as any, res as any);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(mocks.verify).not.toHaveBeenCalled();
    });
});
