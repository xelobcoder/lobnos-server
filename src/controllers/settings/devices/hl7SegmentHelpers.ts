import type { IInterfacingSegment, IObxSegment } from "./hl7SoftwareProcessing";

/** Segments of a parsed HL7 envelope; tolerates a missing/non-array `data` by returning none. */
export function interfacingSegments(payload: { data?: unknown } | null | undefined): IInterfacingSegment[] {
     return Array.isArray(payload?.data) ? payload!.data as IInterfacingSegment[] : [];
}

/** PATIENT_ID (specimen barcode) from the PID segment, trimmed; '' when absent. */
export function extractPidPatientId(payload: { data?: unknown } | null | undefined): string {
     const pidSegment = interfacingSegments(payload).find((seg: any) =>
          typeof seg?.SEGMENT === 'string' && seg.SEGMENT.toUpperCase() === 'PID'
     );
     return String((pidSegment as any)?.PATIENT_ID ?? '').trim();
}

/**
 * OBX segments with OBSERVATION_SUB_ID normalised to the analyte code: falls back to
 * OBSERVATION_ID when empty and takes the second component of a ^-delimited identifier.
 * Returns copies; the incoming payload is not mutated.
 */
export function normalizeObxSegments(payload: { data?: unknown } | null | undefined): IObxSegment[] {
     return interfacingSegments(payload).filter(seg => seg.SEGMENT === 'OBX').map(seg => {
          const normalized = { ...seg } as IObxSegment;

          if (!normalized.OBSERVATION_SUB_ID || normalized.OBSERVATION_SUB_ID.trim() === "") {
               normalized.OBSERVATION_SUB_ID = normalized.OBSERVATION_ID;
          }

          if (typeof normalized.OBSERVATION_SUB_ID === 'string' && normalized.OBSERVATION_SUB_ID.includes('^')) {
               const parts = normalized.OBSERVATION_SUB_ID.split('^');
               if (parts.length >= 2) {
                    normalized.OBSERVATION_SUB_ID = parts[1];
               }
          }
          return normalized;
     });
}
