import {ensureConsentSchema} from '../patients/EConsent';
import {ensureParameterDefinitionSchema} from '../TestCreation/parameterSchema';
import KnexConnection from '../../database/KnexConnections';
import { ensureResultSafetySchema } from './ResultSafetySchema';

export async function bootstrapResultSafetyTables(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     await ensureResultSafetySchema(db);
     await ensureConsentSchema(db);
     await ensureParameterDefinitionSchema(db);
}
