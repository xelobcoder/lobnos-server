import bcrypt from 'bcrypt';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Knex } from 'knex';
import logger from '../../hooks/logger';
import { EmailProvidersRepo } from '../application/email/repositories/EmailProvidersRepo';
import { ProviderFactory } from '../application/email/services/ProviderFactory';
import { formatTenantLoginUsername } from '../auth/TenantLoginUsername';
import { TenantRegistry } from '../Tenancy/TenantRegistry';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalSettingsService } from './PatientPortalSettings';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_DELAY_MS = 60_000;
const MAX_OTP_ATTEMPTS = 5;

export class PatientPortalError extends Error {
     constructor(message: string, readonly statusCode = 400, readonly code = 'PORTAL_ERROR') {
          super(message);
     }
}

/** Patients choose their own password; require enough length and variety to resist guessing. */
export function validatePortalPassword(password: unknown): string {
     const value = typeof password === 'string' ? password : '';
     if (value.length < 8 || value.length > 128 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
          throw new PatientPortalError('Password must be 8-128 characters and include at least one letter and one number', 400, 'WEAK_PASSWORD');
     }
     return value;
}

export const hashInvitationToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Invitation links embed the public organization prefix so the server can find the facility before any lookup. */
export function parseInvitationToken(token: unknown): { organization: string; token: string } | null {
     const value = String(token || '').trim();
     const match = value.match(/^([A-Za-z0-9]{3,32})\.([A-Za-z0-9_-]{40,64})$/);
     return match ? { organization: match[1].toUpperCase(), token: value } : null;
}

const hmac = (value: string) => {
     const secret = process.env.ACCESS_TOKEN_SECRET;
     if (!secret) throw new Error('ACCESS_TOKEN_SECRET must be configured for the patient portal');
     return createHmac('sha256', secret).update(value).digest('hex');
};

const sameHash = (a: string, b: string) => {
     const left = Buffer.from(a, 'hex');
     const right = Buffer.from(b, 'hex');
     return left.length === right.length && timingSafeEqual(left, right);
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const dateOnly = (value: unknown): string | null => {
     if (!value) return null;
     if (value instanceof Date) {
          if (isNaN(value.getTime())) return null;
          const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
          return local.toISOString().slice(0, 10);
     }
     const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
     return match ? match[1] : null;
};

export function maskEmail(email: string | null | undefined): string | null {
     const value = String(email || '');
     const [user, domain] = value.split('@');
     if (!user || !domain) return null;
     return `${user.slice(0, 1)}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

async function sendPortalEmail(tenantId: number, to: string, subject: string, html: string, text: string): Promise<void> {
     const provider = await new EmailProvidersRepo(tenantId).findDefault();
     if (!provider?.id) throw new PatientPortalError('Email delivery is not configured for this facility', 503, 'EMAIL_UNAVAILABLE');
     const result = await new ProviderFactory().create(provider).send({
          queueId: 0, providerId: provider.id, fromEmail: provider.from_email, fromName: provider.from_name,
          to: [to], cc: [], bcc: [], subject, htmlBody: html, plainTextBody: text, attachments: [],
     });
     if (!result.success) throw new PatientPortalError('The email could not be sent. Please try again later.', 503, 'EMAIL_UNAVAILABLE');
}

let dummyHashPromise: Promise<string> | null = null;
const dummyHash = () => (dummyHashPromise ??= bcrypt.hash(randomBytes(16).toString('hex'), 10));

export interface PortalLoginResult {
     ok: boolean;
     reason?: 'INVALID' | 'LOCKED' | 'DISABLED' | 'PORTAL_DISABLED';
     account?: any;
     patient?: any;
}

export class PatientPortalAccountService {
     constructor(private readonly tenantId: number) { }

     private connection(): Promise<Knex> {
          return bootstrapPatientPortal(this.tenantId);
     }

     private settings() {
          return new PatientPortalSettingsService(this.tenantId).get();
     }

     async getAccount(patientid: number) {
          const connection = await this.connection();
          return connection('patient_portal_accounts').where({ patientid }).first();
     }

     private async getPatient(db: Knex | Knex.Transaction, patientid: number) {
          return db('new_patients')
               .select('patientid', 'fullpatientid', 'firstname', 'lastname', 'email', 'dob', 'mobile_number')
               .where({ patientid }).first();
     }

     /** Sets the patient's own password and activates (or re-activates) their portal account. */
     private async activate(trx: Knex.Transaction, patientid: number, password: string, method: string): Promise<string> {
          const loginUsername = await formatTenantLoginUsername(this.tenantId, 'patient', patientid);
          const passwordHash = await bcrypt.hash(password, 10);
          const now = new Date();
          const credentials = await trx('patients_credentials').where({ patientid }).first();
          if (credentials) {
               await trx('patients_credentials').where({ patientid })
                    .update({ password: passwordHash, updated: 'true', updated_on: now, login_username: loginUsername });
          } else {
               await trx('patients_credentials').insert({
                    patientid, username: loginUsername, login_username: loginUsername,
                    password: passwordHash, updated: 'true', updated_on: now,
               });
          }
          const account = await trx('patient_portal_accounts').where({ patientid }).forUpdate().first();
          if (account) {
               await trx('patient_portal_accounts').where({ patientid }).update({
                    status: 'active', activation_method: method, failed_attempts: 0, locked_until: null,
                    session_version: Number(account.session_version || 1) + 1,
                    disabled_by: null, disabled_at: null, activated_at: now, updated_at: now,
               });
          } else {
               await trx('patient_portal_accounts').insert({
                    patientid, status: 'active', activation_method: method, session_version: 1,
                    failed_attempts: 0, activated_at: now, updated_at: now,
               });
          }
          return loginUsername;
     }

     // ---- Staff invitations -------------------------------------------------------------

     async createInvitation(patientid: number, staffId: number, options: { sendEmail?: boolean } = {}) {
          const settings = await this.settings();
          if (!settings.portal_enabled) throw new PatientPortalError('The patient portal is disabled for this facility', 403, 'PORTAL_DISABLED');
          if (!settings.staff_invitations_enabled) throw new PatientPortalError('Staff invitations are disabled for this facility', 403, 'INVITATIONS_DISABLED');
          const connection = await this.connection();
          const patient = await this.getPatient(connection, patientid);
          if (!patient) throw new PatientPortalError('Patient not found', 404, 'NOT_FOUND');

          const tenant = await new TenantRegistry().getTenant(this.tenantId);
          const organization = String(tenant?.platformId || '').toUpperCase();
          if (!organization) throw new PatientPortalError('This facility has no public organization identifier', 500, 'TENANT_UNREGISTERED');

          const token = `${organization}.${randomBytes(32).toString('base64url')}`;
          const now = new Date();
          const expiresAt = new Date(now.getTime() + settings.invitation_expiry_hours * 3_600_000);
          const id = await connection.transaction(async (trx) => {
               // A new invitation supersedes any still-open one, so only the latest link works.
               await trx('patient_portal_invitations')
                    .where({ patientid }).whereNull('used_at').whereNull('revoked_at')
                    .update({ revoked_at: now, revoked_by: staffId });
               const [inserted] = await trx('patient_portal_invitations').insert({
                    patientid, token_hash: hashInvitationToken(token), created_by: staffId, expires_at: expiresAt, created_at: now,
               });
               return Number(inserted);
          });

          let emailed = false;
          if (options.sendEmail && patient.email) {
               const link = `${this.portalBaseUrl()}/patient-access/invite?token=${encodeURIComponent(token)}`;
               try {
                    await sendPortalEmail(this.tenantId, patient.email, 'Your patient portal invitation',
                         `<p>Dear ${escapeHtml(patient.firstname || 'patient')},</p><p>You have been invited to access your laboratory records online.</p><p><a href="${link}">Activate your patient portal account</a></p><p>This link expires on ${expiresAt.toUTCString()} and can only be used once.</p>`,
                         `You have been invited to the patient portal. Activate your account: ${link} (expires ${expiresAt.toUTCString()}, single use).`);
                    emailed = true;
               } catch (error) {
                    logger.warn('[PatientPortal] Invitation email not sent:', (error as Error)?.message);
               }
          }
          return { id, token, expiresAt, emailed, email: maskEmail(patient.email) };
     }

     portalBaseUrl(): string {
          const configured = process.env.PATIENT_PORTAL_URL || process.env.FRONTEND_URL;
          if (configured) return configured.replace(/\/$/, '');
          return process.env.NODE_ENV === 'development' ? 'http://localhost:2377' : '';
     }

     async listInvitations(patientid: number) {
          const connection = await this.connection();
          const rows = await connection('patient_portal_invitations')
               .select('id', 'created_by', 'expires_at', 'used_at', 'revoked_at', 'created_at')
               .where({ patientid }).orderBy('id', 'desc').limit(20);
          const now = Date.now();
          return rows.map((row: any) => ({
               ...row,
               state: row.used_at ? 'used' : row.revoked_at ? 'revoked' : new Date(row.expires_at).getTime() <= now ? 'expired' : 'pending',
          }));
     }

     async revokeInvitation(invitationId: number, staffId: number, patientid?: number): Promise<boolean> {
          const connection = await this.connection();
          const query = connection('patient_portal_invitations')
               .where({ id: invitationId }).whereNull('used_at').whereNull('revoked_at');
          if (patientid) query.andWhere({ patientid });
          return (await query.update({ revoked_at: new Date(), revoked_by: staffId })) > 0;
     }

     private async findUsableInvitation(db: Knex | Knex.Transaction, token: string, lock = false) {
          const query = db('patient_portal_invitations').where({ token_hash: hashInvitationToken(token) });
          if (lock) query.forUpdate();
          const row = await query.first();
          if (!row || row.used_at || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null;
          return row;
     }

     async verifyInvitation(token: string) {
          const settings = await this.settings();
          if (!settings.portal_enabled || !settings.staff_invitations_enabled) return null;
          const connection = await this.connection();
          const invitation = await this.findUsableInvitation(connection, token);
          if (!invitation) return null;
          const patient = await this.getPatient(connection, invitation.patientid);
          if (!patient) return null;
          return {
               firstname: patient.firstname || '',
               loginUsername: await formatTenantLoginUsername(this.tenantId, 'patient', Number(invitation.patientid)),
               expiresAt: invitation.expires_at,
          };
     }

     async acceptInvitation(token: string, password: string) {
          validatePortalPassword(password);
          const settings = await this.settings();
          if (!settings.portal_enabled || !settings.staff_invitations_enabled) {
               throw new PatientPortalError('This invitation is invalid or has expired', 400, 'INVITATION_INVALID');
          }
          const connection = await this.connection();
          return connection.transaction(async (trx) => {
               const invitation = await this.findUsableInvitation(trx, token, true);
               if (!invitation) throw new PatientPortalError('This invitation is invalid or has expired', 400, 'INVITATION_INVALID');
               const patient = await this.getPatient(trx, invitation.patientid);
               if (!patient) throw new PatientPortalError('This invitation is invalid or has expired', 400, 'INVITATION_INVALID');
               const loginUsername = await this.activate(trx, Number(invitation.patientid), password, 'staff_invitation');
               await trx('patient_portal_invitations').where({ id: invitation.id }).update({ used_at: new Date() });
               return { patientid: Number(invitation.patientid), loginUsername };
          });
     }

     // ---- Self-registration -------------------------------------------------------------

     /** Finds exactly one registered patient matching every identity factor; anything else is treated as no match. */
     private async matchPatient(db: Knex | Knex.Transaction, input: { patientNumber: string; dateOfBirth: string; email: string }) {
          const patientNumber = String(input.patientNumber || '').trim();
          const dob = dateOnly(input.dateOfBirth);
          const email = normalizeEmail(input.email);
          if (!patientNumber || !dob || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
          const rows = await db('new_patients')
               .select('patientid', 'fullpatientid', 'firstname', 'email', 'dob')
               .where('fullpatientid', patientNumber)
               .limit(2);
          if (rows.length !== 1) return null;
          const patient = rows[0];
          if (normalizeEmail(patient.email) !== email || dateOnly(patient.dob) !== dob) return null;
          return patient;
     }

     async startSelfRegistration(input: { patientNumber: string; dateOfBirth: string; email: string }): Promise<void> {
          const settings = await this.settings();
          if (!settings.portal_enabled || !settings.self_registration_enabled) {
               throw new PatientPortalError('Online registration is not available for this facility', 403, 'SELF_REGISTRATION_DISABLED');
          }
          const connection = await this.connection();
          const patient = await this.matchPatient(connection, input);
          if (!patient) return;
          const account = await connection('patient_portal_accounts').where({ patientid: patient.patientid }).first();
          if (account?.status === 'disabled') return;

          const recent = await connection('patient_portal_verifications')
               .where({ patientid: patient.patientid }).whereNull('used_at').orderBy('id', 'desc').first();
          if (recent && Date.now() - new Date(recent.created_at).getTime() < OTP_RESEND_DELAY_MS) return;

          const code = String(randomInt(100000, 1000000));
          const now = new Date();
          await connection('patient_portal_verifications').where({ patientid: patient.patientid }).whereNull('used_at')
               .update({ used_at: now });
          const [id] = await connection('patient_portal_verifications').insert({
               patientid: patient.patientid, code_hash: hmac(`${patient.patientid}:${code}`), attempts: 0,
               expires_at: new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60_000), created_at: now,
          });
          try {
               await sendPortalEmail(this.tenantId, patient.email, 'Your patient portal verification code',
                    `<p>Your patient portal verification code is <strong>${code}</strong>.</p><p>It expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, you can ignore this email.</p>`,
                    `Your patient portal verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`);
          } catch (error) {
               await connection('patient_portal_verifications').where({ id }).del();
               throw error;
          }
     }

     async completeSelfRegistration(input: { patientNumber: string; dateOfBirth: string; email: string; code: string; password: string }) {
          validatePortalPassword(input.password);
          const invalid = new PatientPortalError('The verification code is invalid or has expired', 400, 'VERIFICATION_INVALID');
          const settings = await this.settings();
          if (!settings.portal_enabled || !settings.self_registration_enabled) throw invalid;
          if (!/^\d{6}$/.test(String(input.code || ''))) throw invalid;
          const connection = await this.connection();
          const patient = await this.matchPatient(connection, input);
          if (!patient) throw invalid;

          const outcome = await connection.transaction(async (trx) => {
               const account = await trx('patient_portal_accounts').where({ patientid: patient.patientid }).first();
               if (account?.status === 'disabled') return null;
               const row = await trx('patient_portal_verifications')
                    .where({ patientid: patient.patientid }).whereNull('used_at')
                    .andWhere('expires_at', '>', new Date()).andWhere('attempts', '<', MAX_OTP_ATTEMPTS)
                    .orderBy('id', 'desc').forUpdate().first();
               if (!row) return null;
               if (!sameHash(hmac(`${patient.patientid}:${input.code}`), String(row.code_hash))) {
                    await trx('patient_portal_verifications').where({ id: row.id }).increment('attempts', 1);
                    return 'mismatch';
               }
               await trx('patient_portal_verifications').where({ id: row.id }).update({ used_at: new Date() });
               const loginUsername = await this.activate(trx, Number(patient.patientid), input.password, 'self_registration');
               return { patientid: Number(patient.patientid), loginUsername };
          });
          if (!outcome || outcome === 'mismatch') throw invalid;
          return outcome;
     }

     // ---- Sign-in and sessions -----------------------------------------------------------

     async authenticate(patientid: number, password: string): Promise<PortalLoginResult> {
          const settings = await this.settings();
          if (!settings.portal_enabled) return { ok: false, reason: 'PORTAL_DISABLED' };
          const connection = await this.connection();
          const account = await connection('patient_portal_accounts').where({ patientid }).first();
          const credentials = await connection('patients_credentials as pc')
               .leftJoin('new_patients as np', 'np.patientid', 'pc.patientid')
               .select('pc.password', 'np.patientid', 'np.firstname', 'np.lastname', 'np.email', 'np.fullpatientid')
               .where('pc.patientid', patientid).first();
          // Compare a hash even when the account is missing so response timing does not reveal which IDs exist.
          const storedHash = account && credentials && String(credentials.password || '').startsWith('$2')
               ? String(credentials.password) : await dummyHash();
          const matched = await bcrypt.compare(String(password || ''), storedHash);
          if (!account || !credentials || !credentials.patientid) return { ok: false, reason: 'INVALID' };
          if (account.status !== 'active') return { ok: false, reason: 'DISABLED' };
          if (account.locked_until && new Date(account.locked_until).getTime() > Date.now()) return { ok: false, reason: 'LOCKED' };

          if (!matched || storedHash !== credentials.password) {
               const failures = Number(account.failed_attempts || 0) + 1;
               const lock = failures >= MAX_FAILED_LOGINS;
               await connection('patient_portal_accounts').where({ patientid }).update({
                    failed_attempts: lock ? 0 : failures,
                    locked_until: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : account.locked_until,
                    updated_at: new Date(),
               });
               return { ok: false, reason: lock ? 'LOCKED' : 'INVALID' };
          }
          await connection('patient_portal_accounts').where({ patientid })
               .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date(), updated_at: new Date() });
          return { ok: true, account, patient: credentials };
     }

     /** Confirms a token still represents an active account; any logout or disable bumps the version. */
     async isSessionValid(patientid: number, sessionVersion: unknown): Promise<boolean> {
          const settings = await this.settings();
          if (!settings.portal_enabled) return false;
          const account = await this.getAccount(patientid);
          return !!account && account.status === 'active' && Number(account.session_version) === Number(sessionVersion);
     }

     async endSessions(patientid: number): Promise<void> {
          const connection = await this.connection();
          await connection('patient_portal_accounts').where({ patientid })
               .update({ session_version: connection.raw('session_version + 1'), updated_at: new Date() });
     }

     async changePassword(patientid: number, currentPassword: string, newPassword: string): Promise<void> {
          validatePortalPassword(newPassword);
          const connection = await this.connection();
          const credentials = await connection('patients_credentials').select('password').where({ patientid }).first();
          const stored = String(credentials?.password || '');
          if (!stored.startsWith('$2') || !(await bcrypt.compare(String(currentPassword || ''), stored))) {
               throw new PatientPortalError('Your current password is incorrect', 400, 'INVALID_PASSWORD');
          }
          const hash = await bcrypt.hash(newPassword, 10);
          await connection.transaction(async (trx) => {
               await trx('patients_credentials').where({ patientid }).update({ password: hash, updated: 'true', updated_on: new Date() });
               await trx('patient_portal_accounts').where({ patientid })
                    .update({ session_version: trx.raw('session_version + 1'), updated_at: new Date() });
          });
     }

     async updatePreferences(patientid: number, input: { notify_email?: unknown; notify_sms?: unknown }) {
          const update: Record<string, boolean> = {};
          for (const key of ['notify_email', 'notify_sms'] as const) {
               if (input[key] === undefined) continue;
               if (typeof input[key] !== 'boolean') throw new PatientPortalError(`${key} must be true or false`);
               update[key] = input[key] as boolean;
          }
          const connection = await this.connection();
          if (Object.keys(update).length) {
               await connection('patient_portal_accounts').where({ patientid }).update({ ...update, updated_at: new Date() });
          }
          return connection('patient_portal_accounts').select('notify_email', 'notify_sms').where({ patientid }).first();
     }

     // ---- Staff account management -------------------------------------------------------

     async getAccessSummary(patientid: number) {
          const connection = await this.connection();
          const patient = await this.getPatient(connection, patientid);
          if (!patient) throw new PatientPortalError('Patient not found', 404, 'NOT_FOUND');
          const account = await connection('patient_portal_accounts')
               .select('status', 'activation_method', 'activated_at', 'last_login_at', 'locked_until', 'disabled_at')
               .where({ patientid }).first();
          return {
               patientid,
               loginUsername: await formatTenantLoginUsername(this.tenantId, 'patient', patientid),
               hasEmail: !!patient.email,
               email: maskEmail(patient.email),
               account: account || null,
               invitations: await this.listInvitations(patientid),
          };
     }

     async setAccess(patientid: number, enabled: boolean, staffId: number): Promise<boolean> {
          const connection = await this.connection();
          const now = new Date();
          return connection.transaction(async (trx) => {
               const account = await trx('patient_portal_accounts').where({ patientid }).forUpdate().first();
               if (!account) return false;
               if (enabled) {
                    await trx('patient_portal_accounts').where({ patientid }).update({
                         status: 'active', disabled_by: null, disabled_at: null, failed_attempts: 0, locked_until: null, updated_at: now,
                    });
               } else {
                    await trx('patient_portal_accounts').where({ patientid }).update({
                         status: 'disabled', disabled_by: staffId, disabled_at: now,
                         session_version: Number(account.session_version || 1) + 1, updated_at: now,
                    });
                    await trx('patient_portal_invitations').where({ patientid }).whereNull('used_at').whereNull('revoked_at')
                         .update({ revoked_at: now, revoked_by: staffId });
               }
               return true;
          });
     }
}

function escapeHtml(value: string): string {
     return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
}
