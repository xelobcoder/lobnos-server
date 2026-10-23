import KnexConnection from '../../../database/KnexConnections';

export class QCRequiredError extends Error {
     readonly statusCode = 423;
     readonly code = 'QC_REQUIRED';
     constructor(message = 'QC Required: record and accept current QC for this branch and analyzer before entering patient results.') { super(message); this.name = 'QCRequiredError'; }
}
export interface QCScope { branchid: number; deviceId?: string | null }
export async function getDailyQcStatus(tenantId: number, testId: number, scope?: QCScope, connection?: any): Promise<any> {
     const db = connection || await KnexConnection(tenantId);
     const test = await db('test_panels').select('requires_qc').where({ id: testId }).first();
     if (!test || ![1, true, '1'].includes(test.requires_qc)) return { required: false, allowed: true, reason: null };
     if (!scope?.branchid) return { required: true, allowed: false, reason: 'QC requires the patient request branch' };
     let query = db('qc_session_review_audit as review')
          .innerJoin('qc_sessions as session', 'session.id', 'review.session_id')
          .innerJoin('control_materials as material', 'material.id', 'session.controlMaterialId')
          .where('review.testid', testId).where('review.branchid', scope.branchid)
          .whereRaw('review.working_date = CURRENT_DATE()')
          .select('review.*', 'material.status as material_status', 'material.expiryDate as expiry_date', 'material.deviceId as current_device_id', db.raw('DATE(session.createdAt) = CURRENT_DATE() as session_is_today'), db.raw('DATE(material.expiryDate) >= CURRENT_DATE() as material_unexpired'));
     query = scope.deviceId ? query.where('review.device_id', scope.deviceId) : query.whereNull('review.device_id');
     const review = await query.orderBy('review.id', 'desc').first();
     let reason: string | null = null;
     if (!review) reason = 'No current QC review for this branch and analyzer. Set the analyzer in the laboratory workbench and review its QC session.';
     else if (review.decision === 'rejected') reason = 'The latest QC clearance was rejected or revoked';
     else if (!['accepted', 'bypassed'].includes(review.decision)) reason = 'QC has not been accepted';
     else if (review.material_status !== 'active' || !Number(review.material_unexpired) || !Number(review.session_is_today)) reason = 'The QC session or control material is no longer valid';
     else if (String(review.current_device_id || '') !== String(scope.deviceId || '')) reason = 'The control material analyzer changed; record a new QC review';
     else if (review.decision === 'accepted') {
          const readings = await db('qc_readings').select('status').where({ sessionId: review.session_id });
          if (!readings.length || readings.some((r: any) => r.status !== 'normal')) reason = 'QC readings are missing or no longer all normal';
     }
     return { required: true, allowed: !reason, reason, sessionId: review?.session_id || null, decision: review?.decision || null, branchid: scope.branchid, deviceId: scope.deviceId || null };
}
export async function requireDailyQcAcceptance(tenantId: number, testId: number, scope?: QCScope, connection?: any): Promise<void> {
     const status = await getDailyQcStatus(tenantId, testId, scope, connection);
     if (!status.allowed) throw new QCRequiredError(status.reason);
}
