import { createHash } from 'crypto';
import { z } from 'zod';
import KnexConnection from '../../../database/KnexConnections';

export const packageConfigurationSchema = z.object({
    package_name: z.string().trim().min(1).max(100),
    expectedRevision: z.string().optional(),
    tests: z.array(z.object({ test_id: z.number().int().positive(), concession_mode: z.enum(['none', 'absolute', 'percentage']), concession_value: z.number().finite().min(0) })).min(1),
    organizationIds: z.array(z.number().int().positive()).default([]),
}).superRefine((data, context) => {
    if (new Set(data.tests.map(row => row.test_id)).size !== data.tests.length) context.addIssue({ code: 'custom', message: 'A test can appear only once.' });
    if (new Set(data.organizationIds).size !== data.organizationIds.length) context.addIssue({ code: 'custom', message: 'An organization can appear only once.' });
});
export function configurationRevision(record: any) {
    return createHash('sha256').update(JSON.stringify({ name: record.package_name,
        tests: [...record.tests].map((row: any) => [Number(row.test_id), row.concession_mode, Number(row.concession_value || 0), Number(row.price)]).sort((a, b) => a[0] - b[0]),
        organizations: record.organizations.map((row: any) => Number(row.id)).sort((a: number, b: number) => a - b),
    })).digest('hex');
}
export class PackageConfiguration {
    constructor(private readonly tenantId: number) {}
    async readWith(connection: any, packageId: number, lock = false) {
        let query = connection('packages').where({ id: packageId });
        if (lock) query = query.forUpdate();
        const header = await query.first();
        if (!header) throw new Error('Package not found.');
        const tests = await connection('package_tests as pt').join('test_panels as tp', 'tp.id', 'pt.test_id').where('pt.package_id', packageId).select('pt.*', 'tp.name', 'tp.price');
        const organizations = await connection('package_assignments as pa').join('organization as o', 'o.id', 'pa.organization_id').where({ 'pa.package_id': packageId, 'pa.assignment_type': 'organization' }).select('o.id', 'o.name', 'o.location');
        const record = { ...header, tests, organizations };
        return { ...record, revision: configurationRevision(record) };
    }
    async get(packageId: number) { return this.readWith(await KnexConnection(this.tenantId), packageId); }
    async save(employeeId: number, raw: unknown, packageId?: number) {
        const data = packageConfigurationSchema.parse(raw);
        const connection = await KnexConnection(this.tenantId);
        return connection.transaction(async trx => {
            if (packageId) {
                const current = await this.readWith(trx, packageId, true);
                if (!data.expectedRevision || data.expectedRevision !== current.revision) throw new Error('This package changed. Reload and review the latest configuration before saving. Your draft has been kept.');
            }
            const panels = await trx('test_panels').whereIn('id', data.tests.map(row => row.test_id)).select('id', 'price');
            if (panels.length !== data.tests.length) throw new Error('One or more selected tests no longer exist.');
            for (const row of data.tests) {
                const price = Number(panels.find(panel => Number(panel.id) === row.test_id)?.price);
                if (!Number.isFinite(price) || price < 0 || row.concession_mode === 'percentage' && row.concession_value > 100 || row.concession_mode === 'absolute' && row.concession_value > price || row.concession_mode === 'none' && row.concession_value !== 0) throw new Error('A package discount exceeds the test price or is invalid. Review the selected tests.');
            }
            if (data.organizationIds.length) {
                const organizations = await trx('organization').whereIn('id', data.organizationIds).select('id');
                if (organizations.length !== data.organizationIds.length) throw new Error('One or more selected organizations no longer exist.');
            }
            let id = packageId;
            if (!id) { const ids = await trx('packages').insert({ package_name: data.package_name, created_by: employeeId, created_at: trx.fn.now(), updated_at: trx.fn.now() }); id = Number(ids[0]); }
            else await trx('packages').where({ id }).update({ package_name: data.package_name, updated_at: trx.fn.now() });
            // Replacement is explicit and atomic. Clinician assignments are preserved.
            await trx('package_tests').where({ package_id: id }).del();
            await trx('package_tests').insert(data.tests.map(row => ({ ...row, package_id: id })));
            await trx('package_assignments').where({ package_id: id, assignment_type: 'organization' }).del();
            if (data.organizationIds.length) await trx('package_assignments').insert(data.organizationIds.map(organization_id => ({ package_id: id, organization_id, assignment_type: 'organization', assigned_at: trx.fn.now() })));
            return this.readWith(trx, id!);
        });
    }
}
