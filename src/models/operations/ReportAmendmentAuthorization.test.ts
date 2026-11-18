import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../application/appsettings/result-settings/resultSettings', () => ({
     default: { canStaffApproveResult: vi.fn() },
}));
vi.mock('./imaging/ImagingResultAuditRepository', () => ({
     default: {
          isUltrasoundTest: vi.fn(),
          isResultAuthor: vi.fn(),
     },
}));
vi.mock('./LabAccessPolicy', () => ({
     labAccessSettings: vi.fn(),
}));

import ResultSettings from '../application/appsettings/result-settings/resultSettings';
import ImagingResultAuditRepository from './imaging/ImagingResultAuditRepository';
import { labAccessSettings } from './LabAccessPolicy';
import { canSignReportAmendment } from './ReportAmendmentAuthorization';

const actor = { tenantId: 1, employeeid: 7, role: 'sonographer' };

beforeEach(() => {
     vi.clearAllMocks();
     vi.mocked(ResultSettings.canStaffApproveResult).mockResolvedValue(false);
     vi.mocked(labAccessSettings).mockResolvedValue({ allow_sonographer_amendment_signing: true } as any);
     vi.mocked(ImagingResultAuditRepository.isUltrasoundTest).mockResolvedValue(true);
     vi.mocked(ImagingResultAuditRepository.isResultAuthor).mockResolvedValue(true);
});

describe('report amendment signing authorization', () => {
     it('allows an opted-in sonographer to sign only an ultrasound report they saved', async () => {
          await expect(canSignReportAmendment({}, actor, 10, 20)).resolves.toBe(true);
          expect(ImagingResultAuditRepository.isUltrasoundTest).toHaveBeenCalledWith({}, 20);
          expect(ImagingResultAuditRepository.isResultAuthor).toHaveBeenCalledWith({}, 10, 20, 7);
     });

     it('recognizes the Sonography role alias for amendment signing', async () => {
          await expect(canSignReportAmendment({}, { ...actor, role: 'Sonography' }, 10, 20)).resolves.toBe(true);
     });

     it('keeps sonographer signing disabled unless the facility opts in', async () => {
          vi.mocked(labAccessSettings).mockResolvedValue({ allow_sonographer_amendment_signing: false } as any);
          await expect(canSignReportAmendment({}, actor, 10, 20)).resolves.toBe(false);
          expect(ImagingResultAuditRepository.isUltrasoundTest).not.toHaveBeenCalled();
     });

     it('does not allow opted-in sonographers to sign another service or a colleague report', async () => {
          vi.mocked(ImagingResultAuditRepository.isUltrasoundTest).mockResolvedValue(false);
          await expect(canSignReportAmendment({}, actor, 10, 20)).resolves.toBe(false);

          vi.mocked(ImagingResultAuditRepository.isUltrasoundTest).mockResolvedValue(true);
          vi.mocked(ImagingResultAuditRepository.isResultAuthor).mockResolvedValue(false);
          await expect(canSignReportAmendment({}, actor, 10, 20)).resolves.toBe(false);
     });

     it('preserves access for configured result validators', async () => {
          vi.mocked(ResultSettings.canStaffApproveResult).mockResolvedValue(true);
          await expect(canSignReportAmendment({}, actor, 10, 20)).resolves.toBe(true);
          expect(labAccessSettings).not.toHaveBeenCalled();
     });
});
