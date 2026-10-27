/** All organization writers use this tenant-local transaction lock, including quick-add and imports. */
export async function lockOrganizationDirectory(trx: any) {
    if (!await trx('organization_directory_lock').where({ id: 1 }).forUpdate().first()) throw new Error('Organization directory is not initialized. Restart the service to apply the directory migration.');
}

export class OrganizationIdentityConflict extends Error {
    readonly statusCode = 409;
    constructor(public readonly field: 'email' | 'mobile' | 'name') {
        super(`Another organization already uses this ${field === 'mobile' ? 'contact number' : field}.`);
    }
}

export const organizationEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();
export const organizationPhone = (value: unknown) => {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.startsWith('00233')) digits = digits.slice(2);
    if (digits.startsWith('233') && digits.length === 12) digits = '0' + digits.slice(3);
    return digits;
};

/** Compare legacy formatted values as well as new normalized values. Empty optional values are not identities. */
export async function assertOrganizationIdentity(trx: any, input: { email?: unknown; mobile?: unknown; name?: unknown }, excludeId?: number) {
    const email = organizationEmail(input.email), mobile = organizationPhone(input.mobile);
    // A quick-add may run inside an older parent transaction. Use a current read,
    // not its REPEATABLE READ snapshot, after acquiring the directory lock.
    const rows = await trx('organization').select('id', 'name', 'email', 'mobile').forUpdate();
    for (const row of rows) {
        if (excludeId && Number(row.id) === Number(excludeId)) continue;
        if (email && organizationEmail(row.email) === email) throw new OrganizationIdentityConflict('email');
        if (mobile && organizationPhone(row.mobile) === mobile) throw new OrganizationIdentityConflict('mobile');
        if (input.name && String(row.name ?? '').trim().toLowerCase() === String(input.name).trim().toLowerCase()) throw new OrganizationIdentityConflict('name');
    }
}
