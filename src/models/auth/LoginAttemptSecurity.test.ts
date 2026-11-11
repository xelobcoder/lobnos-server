import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import AuthenticationRepository from '../settings/users/AuthenticationRepository';
import { ensureLoginAttemptSecurity, LoginCooldownError } from './LoginAttemptSecurity';

const fixtures: ReturnType<typeof accountingSqlDatabase>[] = [];
let now = 1000000;
async function facility() {
    const fixture = accountingSqlDatabase();
    fixtures.push(fixture);
    await fixture.db.schema.createTable('roles', table => { table.integer('employeeid').primary(); table.string('password'); });
    await fixture.db('roles').insert([{ employeeid: 7, password: await bcrypt.hash('Correct-secret', 4) }, { employeeid: 8, password: await bcrypt.hash('Other-secret', 4) }]);
    await ensureLoginAttemptSecurity(fixture.db);
    vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
    return fixture;
}
beforeEach(() => { now = 1000000; vi.spyOn(Date, 'now').mockImplementation(() => now); });
afterEach(async () => { vi.restoreAllMocks(); for (const fixture of fixtures.splice(0)) await fixture.db.destroy(); });

describe('persistent staff password cooldown', () => {
    it('enforces five failures then one minute, three more then five minutes, and increasing capped waits', async () => {
        const fixture = await facility();
        for (const [level, wait] of [60,300,900,1800,3600,3600].entries()) {
            const attempts = level === 0 ? 5 : 3;
            for (let index=0; index<attempts-1; index++) expect(await new AuthenticationRepository(1).validatePassword('s0007','wrong')).toBeNull();
            await expect(new AuthenticationRepository(1).validatePassword('S7','wrong')).rejects.toMatchObject({ retryAfter: wait });
            const before = await fixture.db('login_attempt_security').where({ employeeid: 7 }).first();
            await expect(new AuthenticationRepository(1).validatePassword('S07','Correct-secret')).rejects.toBeInstanceOf(LoginCooldownError);
            expect(await fixture.db('login_attempt_security').where({ employeeid:7 }).first()).toEqual(before);
            now += wait*1000;
        }
        expect((await new AuthenticationRepository(1).validatePassword('S7','Correct-secret')).employeeid).toBe(7);
        expect(await fixture.db('login_attempt_security').where({ employeeid:7 }).first()).toMatchObject({ failures:0,level:0,locked_until:0 });
    });
    it('preserves committed failures under concurrent requests and separates facilities and accounts', async () => {
        const first = await facility();
        const results = await Promise.allSettled(Array.from({length:5},()=>new AuthenticationRepository(1).validatePassword('S7','wrong')));
        expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
        expect((await new AuthenticationRepository(1).validatePassword('S8','Other-secret')).employeeid).toBe(8);
        await expect(new AuthenticationRepository(1).validatePassword('S7','wrong')).rejects.toMatchObject({retryAfter:60});
        const second = await facility();
        expect((await new AuthenticationRepository(2).validatePassword('S7','Correct-secret')).employeeid).toBe(7);
        expect((await first.db('login_attempt_security').where({employeeid:7}).first()).level).toBe(1);
        expect((await second.db('login_attempt_security').where({employeeid:7}).first()).level).toBe(0);
    });
    it('does not create account state for arbitrary usernames or count successful authentication as a failure', async () => {
        const {db}=await facility();
        for(const identifier of ['S999','S0','invalid','S7@example.test']) expect(await new AuthenticationRepository(1).validatePassword(identifier,'wrong')).toBeNull();
        expect(await db('login_attempt_security')).toHaveLength(0);
        expect(await new AuthenticationRepository(1).validatePassword('S7','wrong')).toBeNull();
        await new AuthenticationRepository(1).validatePassword('S7','Correct-secret');
        expect((await db('login_attempt_security').where({employeeid:7}).first()).failures).toBe(0);
    });
});
