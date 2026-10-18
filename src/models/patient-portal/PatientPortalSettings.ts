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
     result_notifications_enabled: boolean;
     appointment_slot_capacity: number;
     booking_start_hour: number;
     booking_end_hour: number;
     home_collection_enabled: boolean;
     home_collection_slot_capacity: number;
     home_collection_note: string;
     payment_instructions: string;
     help_contact: string;
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
     result_notifications_enabled: true,
     appointment_slot_capacity: 4,
     booking_start_hour: 7,
     booking_end_hour: 17,
     home_collection_enabled: false,
     home_collection_slot_capacity: 3,
     home_collection_note: '',
     payment_instructions: '',
     help_contact: '',
});

const BOOLEAN_KEYS = [
     'portal_enabled', 'self_registration_enabled', 'staff_invitations_enabled', 'require_payment_for_results',
     'appointment_requests_enabled', 'billing_enabled', 'email_notifications_enabled', 'sms_notifications_enabled',
     'result_notifications_enabled', 'home_collection_enabled',
] as const;

/** Whole-number settings with their inclusive bounds. */
const INTEGER_KEYS = {
     appointment_slot_capacity: [1, 50],
     home_collection_slot_capacity: [1, 50],
     booking_start_hour: [0, 23],
     booking_end_hour: [1, 24],
} as const;

/** Free-text settings shown to patients, with their maximum lengths. */
const TEXT_KEYS = {
     home_collection_note: 500,
     payment_instructions: 1000,
     help_contact: 300,
} as const;

type IntegerKey = keyof typeof INTEGER_KEYS;
type TextKey = keyof typeof TEXT_KEYS;

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
     for (const [key, [min, max]] of Object.entries(INTEGER_KEYS) as Array<[IntegerKey, readonly [number, number]]>) {
          const value = Number(row[key]);
          if (row[key] !== null && row[key] !== undefined && Number.isInteger(value) && value >= min && value <= max) settings[key] = value;
     }
     if (settings.booking_start_hour >= settings.booking_end_hour) {
          settings.booking_start_hour = DEFAULT_PATIENT_PORTAL_SETTINGS.booking_start_hour;
          settings.booking_end_hour = DEFAULT_PATIENT_PORTAL_SETTINGS.booking_end_hour;
     }
     for (const [key, max] of Object.entries(TEXT_KEYS) as Array<[TextKey, number]>) {
          if (typeof row[key] === 'string') settings[key] = (row[key] as string).slice(0, max);
     }
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
          } else if (key in INTEGER_KEYS) {
               const [min, max] = INTEGER_KEYS[key as IntegerKey];
               const parsed = Number(value);
               if (value === null || value === '' || !Number.isInteger(parsed) || parsed < min || parsed > max) {
                    throw new PatientPortalSettingsError(`${key} must be a whole number between ${min} and ${max}`);
               }
               update[key as IntegerKey] = parsed;
          } else if (key in TEXT_KEYS) {
               const max = TEXT_KEYS[key as TextKey];
               if (typeof value !== 'string' || value.trim().length > max) {
                    throw new PatientPortalSettingsError(`${key} must be text of at most ${max} characters`);
               }
               update[key as TextKey] = value.trim();
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
          if (next.booking_start_hour >= next.booking_end_hour) {
               throw new PatientPortalSettingsError('Booking hours must start before they end');
          }
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
