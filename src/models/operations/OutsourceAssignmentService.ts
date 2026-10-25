import { z } from 'zod';
import type { AuthUser } from '../../middleware/authority';
import { assertLabTestAccess, controlsFail } from './LabAccessPolicy';
import { controlAudit } from './CriticalActionService';

export const outsourceAssignmentSchema = z.object({
    outsourceid: z.number().int().positive(),
    expectedOutsourceid: z.number().int().nonnegative().nullable(),
    version: z.number().int().positive().nullable(),
    reason: z.string().trim().min(3).max(2000),
});

/** Assigning a receiving laboratory never marks a specimen collected or records a payment. */
export class OutsourceAssignmentService {
    constructor(private db: any) {}

    async forBilling(actor: AuthUser, billingid: number) {
        const bill = await this.db('billing').where({ billingid }).first();
        if (!bill || actor.branch != null && Number(bill.branchid) !== Number(actor.branch))
            return controlsFail('Billing record not found in your branch', 404);
        const rows = await this.db('test_ascension as test')
            .join('dboservices as service', 'service.serviceid', 'test.serviceid')
            .where('service.billingid', billingid).where('service.isoutsourced', 1)
            .whereRaw('COALESCE(service.isDeleted,0)=0').select('test.id');
        const permitted = [];
        for (const row of rows) {
            try { permitted.push(await this.context(actor, row.id)); }
            catch (error: any) { if (![403, 404].includes(error.statusCode)) throw error; }
        }
        return permitted;
    }

    private async order(actor: AuthUser, ascensionid: number) {
        await assertLabTestAccess(this.db, actor, ascensionid);
        const row = await this.db('test_ascension as test')
            .join('dboservices as service', 'service.serviceid', 'test.serviceid')
            .join('test_panels as panel', 'panel.id', 'test.testid')
            .where('test.id', ascensionid).whereRaw('COALESCE(service.isDeleted,0)=0')
            .select('test.id as ascensionid', 'test.testid', 'service.serviceid', 'service.outsourceid',
                'service.isoutsourced', 'service.billingid', 'panel.name as test_name').first();
        if (!row || Number(row.isoutsourced) !== 1) return controlsFail('Outsourced ordered test not found', 404);
        return row;
    }

    async context(actor: AuthUser, ascensionid: number) {
        const order = await this.order(actor, ascensionid);
        const cases = await this.db('outsourcedtesttracking').where({ serviceid: order.serviceid, testid: order.testid });
        if (cases.length > 1) return controlsFail('Multiple outsourcing cases need supervisor reconciliation', 409);
        // Offer the same configured organizations used by billing, including legacy mappings.
        const detail = await this.db('testdetails').where({ testid: order.testid }).first();
        const ids = String(detail?.OutSourcingList || detail?.outSourcingList || '').split(',')
            .map(Number).filter(id => Number.isSafeInteger(id) && id > 0);
        const providers = await this.db('lab_outsource_providers').where({ testid: order.testid, active: true });
        for (const provider of providers) if (!ids.includes(Number(provider.outsourceid))) ids.push(Number(provider.outsourceid));
        const organizations = ids.length ? await this.db('outsourcingorganization').whereIn('outsourceid', ids)
            .select('outsourceid', 'name').orderBy('name') : [];
        return { ...order, tracking: cases[0] || null, organizations };
    }

    async assign(actor: AuthUser, ascensionid: number, input: unknown) {
        const data = outsourceAssignmentSchema.parse(input);
        const context = await this.context(actor, ascensionid);
        await assertLabTestAccess(this.db, actor, ascensionid, true);
        if (!context.organizations.some((row: any) => Number(row.outsourceid) === data.outsourceid))
            return controlsFail('Choose an organization configured for this test');
        await this.db.transaction(async (trx: any) => {
            // The service lock also serializes first-time assignment when no tracking row exists.
            const service = await trx('dboservices').where({ serviceid: context.serviceid }).forUpdate().first();
            if (!service || Number(service.isDeleted) === 1 || Number(service.isoutsourced) !== 1)
                return controlsFail('The ordered test changed. Reload before assigning.', 409);
            if (Number(service.outsourceid || 0) !== Number(data.expectedOutsourceid || 0))
                return controlsFail('The receiving laboratory changed. Reload before assigning.', 409);
            const cases = await trx('outsourcedtesttracking').where({ serviceid: context.serviceid, testid: context.testid }).forUpdate();
            if (cases.length > 1) return controlsFail('Multiple outsourcing cases need supervisor reconciliation', 409);
            const old = cases[0];
            if ((old ? Number(old.workflow_version) : null) !== data.version)
                return controlsFail('The outsourcing case changed. Reload before assigning.', 409);
            if (old && !['legacy_pending', 'awaiting_dispatch'].includes(old.workflow_status))
                return controlsFail('A dispatched or closed request cannot change its receiving laboratory', 409);
            if (old && await trx('lab_outsource_reports').where({ tracking_id: old.id }).first())
                return controlsFail('A case with a returned report cannot change its receiving laboratory', 409);
            if (old && Number(old.outsourceid) === data.outsourceid) return;
            if (await trx('expensesrecord').where({ serviceid: context.serviceid, isassociatedservice: 1 }).first())
                return controlsFail('Reconcile the existing outsourcing expense before changing the receiving laboratory', 409);
            const provider = await trx('lab_outsource_providers').where({ testid: context.testid, outsourceid: data.outsourceid, active: true }).first();
            const legacy = await trx('outsourceorganizationservices').where({ generalTestId: context.testid, outsourceid: data.outsourceid }).first();
            const cost = provider?.cost ?? legacy?.outsourcePrice ?? null;
            await trx('dboservices').where({ serviceid: context.serviceid }).update({ outsourceid: data.outsourceid, outsourceprice: cost });
            const changes = { outsourceid: data.outsourceid, workflow_status: 'awaiting_dispatch',
                workflow_version: old ? Number(old.workflow_version) + 1 : 1,
                snapshot_cost: cost, snapshot_currency: provider?.currency || 'GHS',
                external_reference: null, due_at: null, dispatched_at: null, updatedOn: new Date(), comments: data.reason };
            let id = old?.id;
            if (old) await trx('outsourcedtesttracking').where({ id }).update(changes);
            else [id] = await trx('outsourcedtesttracking').insert({ ...changes, serviceid: context.serviceid,
                testid: context.testid, employeeid: actor.employeeid, status: 0 });
            await controlAudit(trx, actor.employeeid, 'outsource_case', Number(id), 'organization_assigned', data.reason,
                { before: old || null, changes, ascensionid });
        });
        return this.context(actor, ascensionid);
    }
}
