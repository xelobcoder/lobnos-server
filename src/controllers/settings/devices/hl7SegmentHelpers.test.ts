import { describe, expect, it } from 'vitest';
import { extractPidPatientId, normalizeObxSegments } from './hl7SegmentHelpers';

describe('hl7SegmentHelpers', () => {
  it('reads PATIENT_ID from a PID segment (case-insensitive segment name), trimmed', () => {
    expect(extractPidPatientId({ data: [{ SEGMENT: 'msh' }, { SEGMENT: 'pid', PATIENT_ID: ' 1234-7 ' }] })).toBe('1234-7');
  });
  it('returns empty for missing PID or non-array data', () => {
    expect(extractPidPatientId({ data: [{ SEGMENT: 'OBX' }] })).toBe('');
    expect(extractPidPatientId({ data: { PatientID: '1-2' } })).toBe('');
    expect(extractPidPatientId(undefined)).toBe('');
    expect(normalizeObxSegments({ data: 'x' })).toEqual([]);
  });
  it('normalises OBX analyte codes without mutating the payload', () => {
    const obx = { SEGMENT: 'OBX', OBSERVATION_ID: '6690-2^WBC^LN', OBSERVATION_SUB_ID: '', OBSERVATION_VALUE: '6.1' };
    const kept = { SEGMENT: 'OBX', OBSERVATION_ID: 'x', OBSERVATION_SUB_ID: 'HGB', OBSERVATION_VALUE: '13' };
    const out = normalizeObxSegments({ data: [{ SEGMENT: 'PID' }, obx, kept] });
    expect(out.map((s) => s.OBSERVATION_SUB_ID)).toEqual(['WBC', 'HGB']);
    expect(obx.OBSERVATION_SUB_ID).toBe('');
  });
});
