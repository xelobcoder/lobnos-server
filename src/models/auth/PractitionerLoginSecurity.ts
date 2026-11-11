import type { Knex } from 'knex';
import { ensurePortalLoginAttemptSecurity, LoginCooldownError, verifyPortalPassword } from './LoginAttemptSecurity';

export async function verifyPractitionerCredentials(
    db: Knex, clinicianid: number, compare: (credentials: any) => Promise<boolean>,
): Promise<any | null> {
    await ensurePortalLoginAttemptSecurity(db);
    const result = await db.transaction(async trx => {
        const credentials = await trx('clinicianscredentials').where({ clinicianid }).forUpdate().first();
        if (!credentials) return { credentials: null, retryAfter: undefined };
        const attempt = await verifyPortalPassword(trx, 'clinician', clinicianid, () => compare(credentials));
        return { credentials: attempt.matched ? credentials : null, retryAfter: attempt.retryAfter };
    });
    if (result.retryAfter) throw new LoginCooldownError(result.retryAfter);
    return result.credentials;
}
