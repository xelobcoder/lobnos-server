import KnexConnection from '../../../database/KnexConnections';
import { systemConfigConnection } from '../../../database/connection';
import { configuration } from '../../../hooks/configuration';
import { MODULE_CONFIG_TABLE, validateModuleConfiguration } from '../../Tenancy/FacilityModules';

export async function isSmsActive(tenantId: number, dbOverride?: any): Promise<boolean> {
    const db = dbOverride || await KnexConnection(tenantId);
    const settings = await db('applicationsettings').where({ keyid: 1 }).first();
    if (Number(settings?.smsActivated) !== 1) return false;
    if (configuration.isMultiTenant) {
        const row = await systemConfigConnection(MODULE_CONFIG_TABLE).where({ tenant_id: tenantId }).first('configuration');
        return !!row && !!validateModuleConfiguration(typeof row.configuration === 'string' ? JSON.parse(row.configuration) : row.configuration)?.modules.sms.enabled;
    }
    return !settings.moduleConfiguration || !!validateModuleConfiguration(typeof settings.moduleConfiguration === 'string' ? JSON.parse(settings.moduleConfiguration) : settings.moduleConfiguration)?.modules.sms.enabled;
}
