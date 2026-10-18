import logger from '../../hooks/logger';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';

export type PortalActorType = 'patient' | 'staff' | 'public' | 'system';

export interface PortalAuditEntry {
     patientid?: number | null;
     actorType: PortalActorType;
     actorId?: number | null;
     action: string;
     resource?: string | null;
     resourceId?: string | number | null;
     ipAddress?: string | null;
}

/**
 * Records portal access and account changes. Auditing must never block the patient's request, so
 * failures are logged and swallowed. Entries hold identifiers only — never passwords, tokens or codes.
 */
export async function recordPortalAudit(tenantId: number, entry: PortalAuditEntry): Promise<void> {
     try {
          const connection = await bootstrapPatientPortal(tenantId);
          await connection('patient_portal_audit').insert({
               patientid: entry.patientid ?? null,
               actor_type: entry.actorType,
               actor_id: entry.actorId ?? null,
               action: entry.action.slice(0, 60),
               resource: entry.resource ? String(entry.resource).slice(0, 60) : null,
               resource_id: entry.resourceId === undefined || entry.resourceId === null ? null : String(entry.resourceId).slice(0, 60),
               ip_address: entry.ipAddress ? String(entry.ipAddress).slice(0, 64) : null,
               created_at: new Date(),
          });
     } catch (error) {
          logger.error('[PatientPortalAudit] Failed to record audit entry:', (error as Error)?.message);
     }
}
