import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findAscension: vi.fn(),
  getTestInfo: vi.fn(),
  rules: vi.fn(),
  billing: vi.fn(),
  resultEntry: vi.fn(),
}));
vi.mock('../../../models/operations/ascension', () => ({ TestAscension: { findAscension: mocks.findAscension } }));
vi.mock('../../../testpanel/testpanelList', () => ({ testpanel: { getTestInfo: mocks.getTestInfo } }));
vi.mock('../../../models/TestCreation/TestCreationRulesRepository', () => ({ default: class { findByTestId = mocks.rules; } }));
vi.mock('../../../database/TiifuWorkingClass', () => ({ TiifuWorkingClass: class { findOne = mocks.billing; } }));
vi.mock('../../../models/creator/creator', () => ({ default: class { resultEntry = mocks.resultEntry; } }));
vi.mock('./constants/config', () => ({ PRIME_LAB_SYS_DEVICE_CONFIG: { CSVID_PREFIX: 'csv-', PTID_PREFIX: 'pt-' } }));

import { handleReceivedIntefacingDataProcessor } from './hl7SoftwareProcessing';

afterEach(() => vi.resetAllMocks());

const staff = { employeeid: 7, email: 'ops@lab.test', role: 'scientist', branch: 2, tenantId: 3 };

function arrange() {
  mocks.findAscension.mockResolvedValue({ testid: 11, billingid: 500 });
  mocks.getTestInfo.mockResolvedValue({ deviceInterfaceMapping: JSON.stringify({ 21: 'WBC' }) });
  mocks.rules.mockResolvedValue([{ id: 21, name: 'White cells' }]);
  mocks.billing.mockResolvedValue({ patientid: 900 });
  mocks.resultEntry.mockResolvedValue(true);
}

// Barcode "1234-99": ascension 1234, legacy embedded employee 99 (not the session user).
const bioLab = { PatientID: '1234-99', employeeid: 99, Results: [{ Code: 'WBC', Name: 'WBC', Value: '6.1' }] };
const agile = [
  { SEGMENT: 'PID', PATIENT_ID: '1234-99' },
  { SEGMENT: 'OBX', OBSERVATION_ID: '1^WBC^L', OBSERVATION_SUB_ID: '', OBSERVATION_VALUE: '6.1' },
];

// Parsed HL7 ORU envelope as delivered for MindRay: the agent posts the segment array as `payload`.
const mindRay = [
  { SEGMENT: 'MSH', SENDING_APPLICATION: 'Mindray', MESSAGE_TYPE: 'ORU^R01' },
  { SEGMENT: 'PID', PATIENT_ID: '1234-99' },
  { SEGMENT: 'OBR', FILLER_ORDER_NUMBER: '1234' },
  { SEGMENT: 'OBX', OBSERVATION_ID: '6690-2^WBC^LN', OBSERVATION_SUB_ID: '', OBSERVATION_VALUE: '6.1', UNITS: '10*9/L' },
  { SEGMENT: 'OBX', OBSERVATION_ID: '789-8^RBC^LN', OBSERVATION_SUB_ID: '', OBSERVATION_VALUE: '4.8' },
];

async function post(authUser: unknown, body: unknown) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).authUser = authUser; next(); });
  app.post('/receive', handleReceivedIntefacingDataProcessor);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/receive?tenantId=3&employeeid=99`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe('device result authorship', () => {
  it.each([
    ['BioeLab', bioLab],
    ['AgileS20', agile],
  ])('%s: saves with the authenticated employee, not the barcode/envelope employee', async (name, payload) => {
    arrange();
    const res = await post(staff, { name, payload, employeeid: 99 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', message: 'Data processed successfully' });
    expect(mocks.findAscension).toHaveBeenCalledWith(3, 1234);
    expect(mocks.resultEntry).toHaveBeenCalledTimes(1);
    const [tenantId, finalData] = mocks.resultEntry.mock.calls[0];
    expect(tenantId).toBe(3);
    expect(finalData.employeeid).toBe(7);
    expect(finalData.ascensionid).toBe(1234);
    expect(finalData.testid).toBe(11);
    expect(finalData.fields).toEqual([{ fieldid: 21, value: '6.1', originalvalue: '6.1', field: 'White cells', entrymode: 'automatic' }]);
  });

  it('MindRay: saves PID ascension and OBSERVATION_VALUE with the authenticated employee', async () => {
    arrange();
    const payload = JSON.parse(JSON.stringify(mindRay));
    const res = await post(staff, { name: 'MindRay', payload, employeeid: 99 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', message: 'Data processed successfully' });
    expect(mocks.findAscension).toHaveBeenCalledWith(3, 1234);
    const [, finalData] = mocks.resultEntry.mock.calls[0];
    expect(finalData).toMatchObject({ employeeid: 7, ascensionid: 1234, testid: 11, csvid: 'csv-500', ptid: 'pt-900' });
    expect(finalData.fields).toEqual([{ fieldid: 21, value: '6.1', originalvalue: '6.1', field: 'White cells', entrymode: 'automatic' }]);
  });

  it('MindRay: an OBX with only a non-canonical VALUE is not saved', async () => {
    arrange();
    const payload = [
      { SEGMENT: 'PID', PATIENT_ID: '1234-99' },
      { SEGMENT: 'OBX', OBSERVATION_ID: '6690-2^WBC^LN', OBSERVATION_SUB_ID: '', VALUE: '6.1' },
    ];
    const res = await post(staff, { name: 'MindRay', payload });
    expect(res.status).toBe(500);
    expect(mocks.resultEntry).not.toHaveBeenCalled();
  });

  it('MindRay: missing PID barcode fails without saving', async () => {
    arrange();
    const res = await post(staff, { name: 'MindRay', payload: mindRay.filter((s) => s.SEGMENT !== 'PID') });
    expect(res.status).toBe(500);
    expect(mocks.findAscension).not.toHaveBeenCalled();
    expect(mocks.resultEntry).not.toHaveBeenCalled();
  });

  it('MindRay: a PatientID key in a segment is not used as the barcode', async () => {
    arrange();
    const payload = [
      { SEGMENT: 'MSH', PatientID: '1234-99' },
      { SEGMENT: 'OBX', OBSERVATION_ID: '6690-2^WBC^LN', OBSERVATION_SUB_ID: '', OBSERVATION_VALUE: '6.1' },
    ];
    const res = await post(staff, { name: 'MindRay', payload });
    expect(res.status).toBe(500);
    expect(mocks.findAscension).not.toHaveBeenCalled();
    expect(mocks.resultEntry).not.toHaveBeenCalled();
  });

  it('keeps the existing barcode format requirement (ascensionId-employeeId)', async () => {
    arrange();
    const res = await post(staff, { name: 'BioeLab', payload: { ...bioLab, PatientID: '1234' } });
    expect(res.status).toBe(500);
    expect(mocks.resultEntry).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests before processing', async () => {
    const res = await post(undefined, { name: 'BioeLab', payload: bioLab });
    expect(res.status).toBe(401);
    expect(mocks.findAscension).not.toHaveBeenCalled();
  });

  it.each(['clinician', 'patient'])('rejects %s portal sessions', async (role) => {
    const res = await post({ ...staff, role }, { name: 'BioeLab', payload: bioLab });
    expect(res.status).toBe(403);
    expect(mocks.findAscension).not.toHaveBeenCalled();
  });

  it('does not log patient/result data before insertion', async () => {
    arrange();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await post(staff, { name: 'BioeLab', payload: bioLab });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/pt-900|6\.1/);
    log.mockRestore();
  });
});
