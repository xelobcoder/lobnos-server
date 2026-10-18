import KnexConnection from '../../database/KnexConnections';
import { up as allowOptionalClinicianPhone } from '../../cron/command-line-tool-database/migrations/20261018_optional_clinician_phone';
import { up as createClinicianOrganizations } from '../../cron/command-line-tool-database/migrations/20261018_clinician_organizations';

/**
 * Quick-add from billing creates clinicians by name only, so the phone column must accept NULL,
 * and clinicians may be linked to every organization they refer from.
 */
export async function bootstrapQuickReferralEntities(tenantId: number): Promise<void> {
     const connection = await KnexConnection(tenantId);
     await allowOptionalClinicianPhone(connection);
     await createClinicianOrganizations(connection);
}
