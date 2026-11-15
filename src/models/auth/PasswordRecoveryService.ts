import bcrypt from 'bcrypt';
import { requireStrongPassword } from './PasswordPolicy';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import { EmailProvidersRepo } from '../application/email/repositories/EmailProvidersRepo';
import { ProviderFactory } from '../application/email/services/ProviderFactory';
import { LoginEntityType } from './TenantLoginDirectory';
import { revokePasswordSessions } from './passwordSessions';
import { clearLoginAttempts, ensureLoginAttemptSecurity } from './LoginAttemptSecurity';

const OTP_TABLE = 'password_reset_otps';
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_DELAY_MS = 60_000;
const MAX_OTP_ATTEMPTS = 5;

export class PasswordRecoveryService {
     constructor(private readonly tenantId: number) { }

     private async connection() {
          const connection = await KnexConnection(this.tenantId);
          if (!(await connection.schema.hasTable(OTP_TABLE))) {
               await connection.schema.createTable(OTP_TABLE, (table) => {
                    table.increments('id').unsigned().primary();
                    table.enu('entity_type', ['staff', 'patient', 'clinician']).notNullable();
                    table.integer('entity_id').unsigned().notNullable();
                    table.string('code_hash', 64).notNullable();
                    table.timestamp('expires_at').notNullable();
                    table.integer('attempts').unsigned().notNullable().defaultTo(0);
                    table.timestamp('verified_at').nullable();
                    table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
                    table.unique(['entity_type', 'entity_id'], { indexName: 'uq_password_reset_otp_account' });
               });
          }
          return connection;
     }

     private hashOtp(otp: string): string {
          const secret = process.env.ACCESS_TOKEN_SECRET;
          if (!secret) throw new Error('ACCESS_TOKEN_SECRET must be configured for password recovery');
          return createHmac('sha256', secret).update(otp).digest('hex');
     }

     private async findEmail(entityType: LoginEntityType, entityId: number): Promise<string | null> {
          const connection = await this.connection();
          let row: { email?: string | null; clinician_email?: string | null } | undefined;
          if (entityType === 'staff') {
               const staff = await connection('roles').where({ employeeid: entityId }).first();
               if (Number(staff?.platform_support) === 1) return null;
               row = staff;
          } else if (entityType === 'patient') {
               row = await connection('patients_credentials as pc')
                    .leftJoin('new_patients as np', 'np.patientid', 'pc.patientid')
                    .select('np.email')
                    .where('pc.patientid', entityId)
                    .first();
          } else {
               row = await connection('clinicianscredentials as cc')
                    .leftJoin('clinicianbasicinfo as cbi', 'cbi.id', 'cc.clinicianid')
                    .select('cc.email', 'cbi.email as clinician_email')
                    .where('cc.clinicianid', entityId)
                    .first();
          }
          const email = String(row?.email || row?.clinician_email || '').trim();
          return email || null;
     }

     async sendOtp(entityType: LoginEntityType, entityId: number, suppliedEmail: string): Promise<boolean> {
          const email = await this.findEmail(entityType, entityId);
          if (!email || email.toLowerCase() !== suppliedEmail.trim().toLowerCase()) return false;

          const connection = await this.connection();
          const existing = await connection(OTP_TABLE).where({ entity_type: entityType, entity_id: entityId }).first();
          if (existing && Date.now() - new Date(existing.created_at).getTime() < OTP_RESEND_DELAY_MS) return false;

          const otp = String(randomInt(100000, 1000000));
          const now = new Date();
          await connection(OTP_TABLE).insert({
               entity_type: entityType,
               entity_id: entityId,
               code_hash: this.hashOtp(otp),
               expires_at: new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60_000),
               attempts: 0,
               verified_at: null,
               created_at: now,
          }).onConflict(['entity_type', 'entity_id']).merge([
               'code_hash', 'expires_at', 'attempts', 'verified_at', 'created_at',
          ]);

          try {
               const provider = await new EmailProvidersRepo(this.tenantId).findDefault();
               if (!provider?.id) throw new Error('No active default email provider is configured for this organization');
               const result = await new ProviderFactory().create(provider).send({
                    queueId: 0,
                    providerId: provider.id,
                    fromEmail: provider.from_email,
                    fromName: provider.from_name,
                    to: [email],
                    cc: [],
                    bcc: [],
                    subject: 'Password reset verification code',
                    htmlBody: `<p>Your password reset verification code is <strong>${otp}</strong>.</p><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.</p>`,
                    plainTextBody: `Your password reset verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
                    attachments: [],
               });
               if (!result.success) throw new Error(result.failureReason || 'Password reset email could not be sent');
               return true;
          } catch (error) {
               await connection(OTP_TABLE).where({
                    entity_type: entityType, entity_id: entityId, code_hash: this.hashOtp(otp),
               }).del();
               logger.error('[PasswordRecovery] Failed to send password reset OTP:', error);
               throw error;
          }
     }

     async verifyOtp(entityType: LoginEntityType, entityId: number, otp: string): Promise<boolean> {
          if (!/^\d{6}$/.test(otp)) return false;
          const connection = await this.connection();
          return connection.transaction(async (trx) => {
               const row = await trx(OTP_TABLE)
                    .where({ entity_type: entityType, entity_id: entityId })
                    .andWhere('expires_at', '>', new Date())
                    .andWhere('attempts', '<', MAX_OTP_ATTEMPTS)
                    .forUpdate().first();
               if (!row) return false;

               const suppliedHash = Buffer.from(this.hashOtp(otp), 'hex');
               const storedHash = Buffer.from(String(row.code_hash), 'hex');
               if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
                    await trx(OTP_TABLE).where({ id: row.id }).increment('attempts', 1);
                    return false;
               }

               await trx(OTP_TABLE).where({ id: row.id }).update({ verified_at: new Date() });
               return true;
          });
     }

     async resetPassword(entityType: LoginEntityType, entityId: number, otp: string, password: string): Promise<boolean> {
          requireStrongPassword(password);
          if (!/^\d{6}$/.test(otp)) return false;
          const connection = await this.connection();
          await ensureLoginAttemptSecurity(connection);
          const passwordHash = await bcrypt.hash(password, 10);
          return connection.transaction(async (trx) => {
               const row = await trx(OTP_TABLE)
                    .where({ entity_type: entityType, entity_id: entityId })
                    .whereNotNull('verified_at')
                    .andWhere('expires_at', '>', new Date())
                    .andWhere('attempts', '<', MAX_OTP_ATTEMPTS)
                    .forUpdate().first();
               if (!row) return false;

               const suppliedHash = Buffer.from(this.hashOtp(otp), 'hex');
               const storedHash = Buffer.from(String(row.code_hash), 'hex');
               if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
                    await trx(OTP_TABLE).where({ id: row.id }).increment('attempts', 1);
                    return false;
               }
               let updated: number;
               if (entityType === 'staff') {
                    updated = await trx('roles').where({ employeeid: entityId }).update({
                         password: passwordHash,
                         updated_on: new Date(),
                    });
               } else if (entityType === 'patient') {
                    updated = await trx('patients_credentials').where({ patientid: entityId }).update({
                         password: passwordHash,
                         updated: 'true',
                         updated_on: new Date(),
                    });
               } else {
                    updated = await trx('clinicianscredentials').where({ clinicianid: entityId }).update({
                         password: passwordHash,
                         ispasswordUpdated: 1,
                    });
               }

               if (!updated) return false;
               await revokePasswordSessions(trx, entityType, entityId);
               await clearLoginAttempts(trx, entityType, entityId);
               await trx(OTP_TABLE).where({ id: row.id }).del();
               return true;
          });
     }
}
