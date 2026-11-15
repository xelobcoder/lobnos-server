import { createHash, randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { passwordProblem } from '../auth/PasswordPolicy';
import { FacilityError } from './FacilityInput';
import { systemConfigConnection as db } from '../../database/connection';

const ACCOUNTS = 'platform_owner_account';
const SESSIONS = 'platform_owner_sessions';
const LIFETIME = 3 * 60 * 60;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

let schema: Promise<void> | undefined;
async function createTable(name: string, build: Parameters<typeof db.schema.createTable>[1]) {
     if (await db.schema.hasTable(name)) return;
     try { await db.schema.createTable(name, build); }
     catch (error) { if ((error as { code?: string }).code !== 'ER_TABLE_EXISTS_ERROR') throw error; }
}
function ensureSchema() {
     return schema ??= (async () => {
          await createTable(ACCOUNTS, table => {
               table.integer('id').unsigned().primary();
               table.string('username', 80).notNullable();
               table.string('password_hash', 255).notNullable();
          });
          await createTable(SESSIONS, table => {
               table.string('id', 36).primary();
               table.string('token_hash', 64).notNullable().unique();
               table.dateTime('expires_at').notNullable().index();
          });
     })().catch(error => { schema = undefined; throw error; });
}

export async function initializeMasterOwner(username: string, passwordHash: string) {
     if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username) || !/^\$2[aby]\$\d\d\$[A-Za-z0-9./]{53}$/.test(passwordHash)) {
          throw new Error('A valid username and bcrypt password hash are required');
     }
     await ensureSchema();
     await db(ACCOUNTS).insert({ id: 1, username, password_hash: passwordHash });
}

export async function loginMasterOwner(username: unknown, password: unknown) {
     if (typeof username !== 'string' || username.length > 80 || typeof password !== 'string' ||
          !password || Buffer.byteLength(password, 'utf8') > 72) return null;
     await ensureSchema();
     const account = await db(ACCOUNTS).where({ id: 1 }).first();
     // Keep an unknown username on the same expensive verification path.
     const fallback = '$2b$10$6sTe0QOvZsuyZej9gIQSQ.NNe9/oeFUejyuODf/Qud8/A9HznSBoq';
     const matched = await bcrypt.compare(password, account?.password_hash ?? fallback);
     if (!matched || account?.username !== username.trim().toLowerCase()) return null;
     const secret = randomBytes(32).toString('hex');
     const id = randomUUID();
     const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + LIFETIME * 1000);
     const created = await db.transaction(async trx => {
          const live = await trx(ACCOUNTS).where({ id: 1 }).forUpdate().first();
          if (live?.password_hash !== account.password_hash || live?.username !== account.username) return false;
          await trx(SESSIONS).where('expires_at', '<=', new Date()).delete();
          await trx(SESSIONS).insert({ id, token_hash: hash(secret), expires_at: expiresAt });
          return true;
     });
     return created ? { secret, expiresAt } : null;
}

export async function getMasterSession(token: unknown) {
     if (!validToken(token)) return null;
     await ensureSchema();
     const row = await db(SESSIONS).where({ token_hash: hash(token) }).where('expires_at', '>', new Date()).first('id', 'expires_at');
     if (!row) return null;
     return { master: true as const, sid: String(row.id), employeeid: 1, tid: 0, exp: Math.floor(new Date(row.expires_at).getTime() / 1000) };
}

export async function isMasterSessionActive(id: unknown) {
     if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return false;
     await ensureSchema();
     return Boolean(await db(SESSIONS).where({ id }).where('expires_at', '>', new Date()).first('id'));
}

export async function logoutMasterOwner(token: unknown) {
     if (!validToken(token)) return;
     await ensureSchema();
     await db(SESSIONS).where({ token_hash: hash(token) }).delete();
}

export async function getMasterUsername() {
     await ensureSchema();
     const row = await db(ACCOUNTS).where({ id: 1 }).first('username');
     return row?.username as string | undefined;
}

export async function updateMasterCredentials(sessionId: string, input: unknown) {
     const { username, currentPassword, newPassword } = (input ?? {}) as Record<string, unknown>;
     const nextUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
     if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(nextUsername)) {
          throw new FacilityError('Use 3 to 80 letters, numbers, periods, underscores or hyphens for the username', 400);
     }
     if (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword, 'utf8') > 72) {
          throw new FacilityError('Enter the current master password', 400);
     }
     if (newPassword !== undefined && newPassword !== '') {
          const problem = passwordProblem(newPassword);
          if (problem) throw new FacilityError(problem, 400);
     }
     await ensureSchema();
     const account = await db(ACCOUNTS).where({ id: 1 }).first();
     if (!account || !await bcrypt.compare(currentPassword, account.password_hash)) {
          throw new FacilityError('The current master password is incorrect', 403);
     }
     const nextHash = newPassword ? await bcrypt.hash(newPassword as string, 12) : account.password_hash;
     return db.transaction(async trx => {
          const live = await trx(ACCOUNTS).where({ id: 1 }).forUpdate().first();
          const session = await trx(SESSIONS).where({ id: sessionId }).where('expires_at', '>', new Date()).first('id');
          if (!session || live?.password_hash !== account.password_hash || live?.username !== account.username) {
               throw new FacilityError('The master account changed. Sign in again.', 409);
          }
          if (nextUsername === account.username && nextHash === account.password_hash) return { changed: false };
          await trx(ACCOUNTS).where({ id: 1 }).update({ username: nextUsername, password_hash: nextHash });
          await trx(SESSIONS).delete();
          return { changed: true };
     });
}
