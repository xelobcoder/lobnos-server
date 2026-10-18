import { Knex } from 'knex';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';

export type ResultReleasePolicy = 'approved' | 'manual';

export interface PatientPortalSettings {
     portal_enabled: boolean;
     self_registration_enabled: boolean;
     staff_invitations_enabled: boolean;
     result_release_policy: ResultReleasePolicy;
     require_payment_for_results: boolean;
     appointment_requests_enabled: boolean;
     appointment_request_practitioner: number | null;
     billing_enabled: boolean;
     email_notifications_enabled: boolean;
     sms_notifications_enabled: boolean;
     invitation_expiry_hours: number;
}

export const DEFAULT_PATIENT_PORTAL_SETTINGS: Readonly<PatientPortalSettings> = Object.freeze({
     portal_enabled: false,
     self_registration_enabled: false,
     staff_invitations_enabled: true,
     result_release_policy: 'approved',
     require_payment_for_results: true,
     appointment_requests_enabled: false,
     appointment_request_practitioner: null,
     billing_enabled: true,
     email_notifications_enabled: true,
     sms_notifications_enabled: false,
     invitation_expiry_hours: 72,
});

const BOOLEAN_KEYS = [
     'portal_enabled', 'self_registration_enabled', 'staff_invitations_enabled', 'require_payment_for_results',
     'appointment_requests_enabled', 'billing_enabled', 'email_notifications_enabled', 'sms_notifications_enabled',
] as const;

export class PatientPortalSettingsError extends Error {
     readonly statusCode = 400;
}

const toBoolean = (value: unknown): boolean | undefined => {
     if (value === true || value === 1 || value === '1' || value === 'true') return true;
     if (value === false || value === 0 || value === '0' || value === 'false') return false;
     return undefined;
};

/** Converts a stored row into settings, falling back to the secure defaults for anything missing. */
export function normalizePatientPortalSettings(row: Record<string, unknown> | null | undefined): PatientPortalSettings {
     const settings: PatientPortalSettings = { ...DEFAULT_PATIENT_PORTAL_SETTINGS };
     if (!row) return settings;
     for (const key of BOOLEAN_KEYS) {
          const value = toBoolean(row[key]);
          if (value !== undefined) settings[key] = value;
     }
     if (row.result_release_policy === 'manual' || row.result_release_policy === 'approved') {
          settings.result_release_policy = row.result_release_policy;
     }
     const hours = Number(row.invitation_expiry_hours);
     if (Number.isInteger(hours) && hours >= 1 && hours <= 720) settings.invitation_expiry_hours = hours;
     const practitioner = Number(row.appointment_request_practitioner);
     settings.appointment_request_practitioner = Number.isInteger(practitioner) && practitioner > 0 ? practitioner : null;
     return settings;
}

/** Validates an administrator's partial update; unknown keys are rejected rather than silently stored. */
export function validatePatientPortalSettingsUpdate(input: Record<string, unknown>): Partial<PatientPortalSettings> {
     if (!input || typeof input !== 'object') throw new PatientPortalSettingsError('Settings payload is required');
     const update: Partial<PatientPortalSettings> = {};
     for (const [key, value] of Object.entries(input)) {
          if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
               const parsed = toBoolean(value);
               if (parsed === undefined) throw new PatientPortalSettingsError(`${key} must be true or false`);
               (update as any)[key] = parsed;
          } else if (key === 'result_release_policy') {
               if (value !== 'approved' && value !== 'manual') {
                    throw new PatientPortalSettingsError('result_release_policy must be "approved" or "manual"');
               }
               update.result_release_policy = value;
          } else if (key === 'invitation_expiry_hours') {
               const hours = Number(value);
               if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
                    throw new PatientPortalSettingsError('invitation_expiry_hours must be a whole number between 1 and 720');
               }
               update.invitation_expiry_hours = hours;
          } else if (key === 'appointment_request_practitioner') {
               if (value === null || value === '' || value === undefined) {
                    update.appointment_request_practitioner = null;
               } else {
                    const id = Number(value);
                    if (!Number.isInteger(id) || id <= 0) {
                         throw new PatientPortalSettingsError('appointment_request_practitioner must be a staff member');
                    }
                    update.appointment_request_practitioner = id;
               }
          } else {
               throw new PatientPortalSettingsError(`Unknown patient portal setting: ${key}`);
          }
     }
     return update;
}

export class PatientPortalSettingsService {
     constructor(private readonly tenantId: number) { }

     private async connection(): Promise<Knex> {
          const connection = await bootstrapPatientPortal(this.tenantId);
          const existing = await connection('patient_portal_settings').where({ keyid: 1 }).first();
          if (!existing) {
               await connection('patient_portal_settings')
                    .insert({ keyid: 1, ...DEFAULT_PATIENT_PORTAL_SETTINGS, updated_at: new Date() })
                    .onConflict('keyid').ignore();
          }
          return connection;
     }

     async get(): Promise<PatientPortalSettings> {
          const connection = await this.connection();
          return normalizePatientPortalSettings(await connection('patient_portal_settings').where({ keyid: 1 }).first());
     }

     async update(input: Record<string, unknown>, employeeid: number): Promise<PatientPortalSettings> {
          const update = validatePatientPortalSettingsUpdate(input);
          const connection = await this.connection();
          const current = await this.get();
          const next = { ...current, ...update };
          if (next.appointment_requests_enabled && !next.appointment_request_practitioner) {
               throw new PatientPortalSettingsError('Choose the staff member who receives appointment requests before enabling them');
          }
          if (update.appointment_request_practitioner) {
               const staff = await connection('roles').select('employeeid')
                    .where({ employeeid: update.appointment_request_practitioner }).first();
               if (!staff) throw new PatientPortalSettingsError('The selected staff member does not exist');
          }
          if (Object.keys(update).length) {
               await connection('patient_portal_settings').where({ keyid: 1 })
                    .update({ ...update, updated_by: employeeid || null, updated_at: new Date() });
          }
          return this.get();
     }
}
