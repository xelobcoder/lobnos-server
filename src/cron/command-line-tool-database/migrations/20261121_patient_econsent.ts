import {ensureConsentSchema} from '../../../models/patients/EConsent';
export async function up(db:any){await ensureConsentSchema(db);}
export async function down(){/* Retain signed records and audit events. */}
