import KnexConnection from '../../../database/KnexConnections';

export class QCRequiredError extends Error {
     readonly statusCode = 423;
     readonly code = 'QC_REQUIRED';

     constructor() {
          super('QC Required: Quality control has not been recorded and accepted for this test today. Perform and accept QC before entering patient results.');
          this.name = 'QCRequiredError';
     }
}

export async function requireDailyQcAcceptance(tenantId: number, testId: number): Promise<void> {
     const connection = await KnexConnection(tenantId);
     const test = await connection('test_panels').select('requires_qc').where({ id: testId }).first();
     if (!test || ![1, true, '1'].includes(test.requires_qc)) return;

     const review = await connection('qc_session_review_audit as review')
          .innerJoin('qc_sessions as session', 'session.id', 'review.session_id')
          .innerJoin('control_materials as material', 'material.id', 'session.controlMaterialId')
          .where('review.testid', testId)
          .whereRaw('review.working_date = CURRENT_DATE()')
          .whereRaw('DATE(session.createdAt) = CURRENT_DATE()')
          .where('material.status', 'active')
          .whereRaw('DATE(material.expiryDate) >= CURRENT_DATE()')
          .whereIn('review.decision', ['accepted', 'bypassed'])
          .first();

     if (!review) throw new QCRequiredError();
}