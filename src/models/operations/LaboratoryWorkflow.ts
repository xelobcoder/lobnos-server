import KnexConnection from '../../database/KnexConnections';
import type { Knex } from 'knex';
import ApplicationSettings from '../application/appsettings/appset';

type Stage = 'completed' | 'bypassed' | 'pending';

/** Legacy specimens may have no recorded volume; an explicitly exhausted volume is never usable. */
function hasAvailableMaterial(sample: any): boolean {
    if (!['available', 'retrieved'].includes(sample.storage_state || 'available')) return false;
    const remaining = sample.remaining_quantity ?? sample.quantity;
    return remaining === null || remaining === undefined || (Number.isFinite(Number(remaining)) && Number(remaining) > 0);
}

function hasUsableAliquot(rootId: unknown, children: Map<string, any[]>): boolean {
    const queue = [String(rootId)];
    const visited = new Set<string>();
    while (queue.length) {
        const parentId = queue.pop()!;
        if (visited.has(parentId)) continue;
        visited.add(parentId);
        for (const child of children.get(parentId) || []) {
            if (child.status === 'accepted' && hasAvailableMaterial(child)) return true;
            queue.push(String(child.id));
        }
    }
    return false;
}
export interface LaboratoryWorkflow {
    collection: Stage;
    sampleValidation: Stage;
    processing: Stage;
    canCollect: boolean;
    canValidateSample: boolean;
    canProcess: boolean;
    canEnterResults: boolean;
    blockedReason: string | null;
}

/** Configuration satisfies a workflow step, never a physical operation.
 * Physical links take precedence over legacy dates/status, including on retries and old requests.
 * Superseded containers are excluded by load(); every remaining required container must qualify.
 */
export function laboratoryWorkflow(settings: any, ascension: any, samples: any[]): LaboratoryWorkflow {
    const bypassCollection = Number(settings?.byPassCollection) === 1;
    const bypassValidation = Number(settings?.byPassSampleValidation) === 1;
    const bypassProcessing = Number(settings?.byPassProcessing) === 1;
    const hasSamples = samples.length > 0;
    const collected = hasSamples && samples.every(s => ['collected', 'received', 'accepted'].includes(s.status));
    const accepted = hasSamples && samples.every(s => s.status === 'accepted');
    const rejected = samples.some(s => ['rejected', 'recollection_required'].includes(s.status)) ||
        (!hasSamples && (!!ascension.rejectionmessage || Number(ascension.isRedraw) === 1));
    const unavailable = samples.some(s => !hasAvailableMaterial(s) && !s.has_usable_aliquot);
    const collection: Stage = (hasSamples ? collected : ascension.collectionEndDate)
        ? 'completed' : bypassCollection ? 'bypassed' : 'pending';
    // Legacy acceptance is only usable when there are no physical links.
    const validated = hasSamples ? accepted : Number(ascension.approvalstatus) === 1 && !!ascension.samplevalidatedon;
    const sampleValidation: Stage = validated ? 'completed' : bypassValidation ? 'bypassed' : 'pending';
    let blockedReason: string | null = null;
    if (rejected) blockedReason = 'A required sample is rejected or requires recollection';
    else if (unavailable) blockedReason = 'Retrieve an available specimen or aliquot with remaining material before processing or entering results';
    else if (hasSamples && !collected) blockedReason = 'Complete collection of every required physical container';
    else if (collection === 'pending') blockedReason = 'Sample collection is required';
    else if (!hasSamples && !validated && !bypassValidation) blockedReason = 'Collect a physical sample for validation';
    else if (sampleValidation === 'pending') blockedReason = 'Sample validation is required';
    const prerequisitesMet = !blockedReason;
    const processing: Stage = ascension.processingEndDate ? 'completed' : bypassProcessing ? 'bypassed' : 'pending';
    return {
        collection, sampleValidation, processing,
        // Collection bypass must not prevent obtaining a real sample when validation is required.
        canCollect: !rejected && !collected && (collection === 'pending' || hasSamples || (!validated && !bypassValidation)),
        canValidateSample: !rejected && !bypassValidation && collected && !accepted,
        canProcess: prerequisitesMet && processing === 'pending',
        canEnterResults: prerequisitesMet && processing !== 'pending',
        blockedReason: blockedReason || (processing === 'pending' ? 'Sample processing is required' : null),
    };
}

export class LaboratoryWorkflowService {
    constructor(private tenantId: number) {}

    async forAscensions(rows: any[], connection?: any): Promise<any[]> {
        if (!rows.length) return [];
        const db = connection || await KnexConnection(this.tenantId);
        const settings = await new ApplicationSettings().getAllAppSettings(this.tenantId);
        const ids = rows.map(row => Number(row.ascension_id ?? row.id));
        const links = await db('test_ascension_samples as link')
            .join('physical_samples as sample', 'sample.id', 'link.sample_id')
            .whereIn('link.ascension_id', ids)
            .where('link.is_required', true)
            .whereNotExists(function (this: Knex.QueryBuilder) {
                this.select(db.raw('1')).from('physical_samples as replacement')
                    .join('test_ascension_samples as replacement_link', 'replacement_link.sample_id', 'replacement.id')
                    .whereRaw('replacement.replaces_sample_id = sample.id')
                    .whereRaw('replacement_link.ascension_id = link.ascension_id')
                    .where('replacement_link.is_required', true);
            })
            .select('link.ascension_id', 'sample.id', 'sample.status', 'sample.storage_state', 'sample.quantity', 'sample.remaining_quantity');
        const unavailableRoots = links.filter((sample:any) => !hasAvailableMaterial(sample));
        const childrenByAscension = new Map<number, Map<string, any[]>>();
        if (unavailableRoots.length) {
            // Fetch the linked aliquot forest once. Walking it in JavaScript supports old MySQL
            // installations and follows only descendants belonging to the same ordered test.
            const aliquots = await db('test_ascension_samples as link')
                .join('physical_samples as sample', 'sample.id', 'link.sample_id')
                .whereIn('link.ascension_id', [...new Set(unavailableRoots.map((sample:any) => Number(sample.ascension_id)))])
                .where('link.is_required', false)
                .whereNotNull('sample.parent_sample_id')
                .select('link.ascension_id', 'sample.id', 'sample.parent_sample_id', 'sample.status', 'sample.storage_state', 'sample.quantity', 'sample.remaining_quantity');
            for (const aliquot of aliquots) {
                const ascensionId = Number(aliquot.ascension_id);
                if (!childrenByAscension.has(ascensionId)) childrenByAscension.set(ascensionId, new Map());
                const children = childrenByAscension.get(ascensionId)!;
                const parentId = String(aliquot.parent_sample_id);
                if (!children.has(parentId)) children.set(parentId, []);
                children.get(parentId)!.push(aliquot);
            }
        }
        const requiredSamples = links.map((sample :any)=> ({
            ...sample,
            has_usable_aliquot: !hasAvailableMaterial(sample) && hasUsableAliquot(sample.id, childrenByAscension.get(Number(sample.ascension_id)) || new Map()),
        }));
        return rows.map(row => {
            const workflow = laboratoryWorkflow(settings, row, requiredSamples.filter((link:any) => Number(link.ascension_id) === Number(row.ascension_id ?? row.id)));
            return {
                ...row, workflow,
                sample_validation_stage: workflow.sampleValidation === 'bypassed' ? 'Bypassed' : row.sample_validation_stage,
                current_stage: workflow.canEnterResults && !row.resultEntryStart && !row.resultEntryEnd ? 'Ready for Result Entry' : row.current_stage,
            };
        });
    }

    async forAscension(id: number, connection?: any): Promise<any> {
        const db = connection || await KnexConnection(this.tenantId);
        const row = await db('test_ascension as ta')
            .leftJoin('samplestatus as ss', 'ss.ascensionid', 'ta.id')
            .where('ta.id', id).select('ta.*', 'ss.approvalstatus', 'ss.samplevalidatedon', 'ss.rejectionmessage', 'ss.isRedraw').first();
        if (!row) throw Object.assign(new Error('Ordered test not found'), { statusCode: 404 });
        return (await this.forAscensions([row], db))[0];
    }

    async requireResultEntry(id: number, testid: number, billingid: number, patientid: number): Promise<void> {
        const db = await KnexConnection(this.tenantId);
        const row = await this.forAscension(id, db);
        const bill = await db('billing').where({ billingid: row.billingid }).first('patientid');
        if (Number(row.testid) !== Number(testid) || Number(row.billingid) !== Number(billingid) || Number(bill?.patientid) !== Number(patientid)) {
            throw Object.assign(new Error('Ordered test does not belong to this request'), { statusCode: 403 });
        }
        const panel = await db('test_panels as panel').join('departments as department', 'department.id', 'panel.category')
            .where('panel.id', row.testid).first('department.department');
        // Imaging has its own workflow; do not trust a client-provided isScan flag.
        if (String(panel?.department).toLowerCase() === 'ultrasound') return;
        if (!row.workflow.canEnterResults) throw Object.assign(new Error(row.workflow.blockedReason), { statusCode: 409 });
    }
}
