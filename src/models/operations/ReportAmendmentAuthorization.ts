import { normalizeRole } from '../../middleware/roles';
import ResultSettings from '../application/appsettings/result-settings/resultSettings';
import ImagingResultAuditRepository from './imaging/ImagingResultAuditRepository';
import { labAccessSettings } from './LabAccessPolicy';

export async function canSignReportAmendment(
     db: any,
     actor: { tenantId: number; employeeid: number; role: string },
     ascensionid: number,
     testid: number,
): Promise<boolean> {
     if (await ResultSettings.canStaffApproveResult(actor.tenantId, actor.employeeid)) return true;
     if (normalizeRole(actor.role) !== 'sonographer') return false;

     const settings = await labAccessSettings(db);
     if (Number(settings.allow_sonographer_amendment_signing) !== 1) return false;
     if (!await ImagingResultAuditRepository.isUltrasoundTest(db, testid)) return false;
     return ImagingResultAuditRepository.isResultAuthor(db, ascensionid, testid, actor.employeeid);
}
