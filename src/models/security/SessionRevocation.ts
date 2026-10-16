import KnexConnection from '../../database/KnexConnections';

const COLUMNS: Array<[string, (table: any) => void]> = [
     ['forcedLogoutBy', table => table.integer('forcedLogoutBy').nullable()],
     ['forcedLogoutAt', table => table.dateTime('forcedLogoutAt').nullable()],
     ['forcedLogoutReason', table => table.string('forcedLogoutReason', 255).nullable()],
];

export class SessionRevocationError extends Error {
     constructor(message: string, public statusCode: number) {
          super(message);
     }
}

/**
 * Administrator-initiated sign-out of a single tracked login session. The per-request session check
 * (verifyStaffSession) rejects any session flagged loggedout, so the user is signed out on their next request.
 */
export class SessionRevocation {
     private static ready = new Map<number, Promise<void>>();

     constructor(private tenantId: number) { }

     private ensureColumns(): Promise<void> {
          let pending = SessionRevocation.ready.get(this.tenantId);
          if (!pending) {
               pending = (async () => {
                    const db = await KnexConnection(this.tenantId);
                    if (!(await db.schema.hasTable('loginlogs'))) return;
                    for (const [name, add] of COLUMNS) {
                         if (await db.schema.hasColumn('loginlogs', name)) continue;
                         try {
                              await db.schema.alterTable('loginlogs', add);
                         } catch (error: any) {
                              if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
                         }
                    }
               })().catch(error => {
                    SessionRevocation.ready.delete(this.tenantId);
                    throw error;
               });
               SessionRevocation.ready.set(this.tenantId, pending);
          }
          return pending;
     }

     async forceLogout(sessionKey: number, actorEmployeeId: number, reason?: string) {
          if (!Number.isSafeInteger(sessionKey) || sessionKey <= 0) throw new SessionRevocationError('Invalid session', 400);
          await this.ensureColumns();
          const db = await KnexConnection(this.tenantId);
          const session = await db('loginlogs').where({ keyid: sessionKey }).first('keyid', 'employeeid', 'loggedout', 'logoutTime');
          if (!session) throw new SessionRevocationError('Session not found', 404);
          const alreadyClosed = Number(session.loggedout) === 1 || new Date(session.logoutTime).getTime() <= Date.now();
          if (alreadyClosed) throw new SessionRevocationError('Session is already signed out', 409);
          const now = new Date();
          const updated = await db('loginlogs').where({ keyid: sessionKey }).whereRaw('COALESCE(loggedout, 0) = 0').update({
               logoutTime: now, actualLogout: now, loggedout: 1,
               forcedLogoutBy: actorEmployeeId, forcedLogoutAt: now,
               forcedLogoutReason: reason ? reason.trim().slice(0, 255) : null,
          });
          if (updated !== 1) throw new SessionRevocationError('Session is already signed out', 409);
          return { sessionKey, employeeid: Number(session.employeeid), forcedLogoutAt: now };
     }

     async history(page: number, count: number, employeeid: number | null) {
          await this.ensureColumns();
          const db = await KnexConnection(this.tenantId);
          const query = db('loginlogs as ll')
               .innerJoin('roles as rl', 'rl.employeeid', 'll.employeeid')
               .leftJoin('roles as fb', 'fb.employeeid', 'll.forcedLogoutBy')
               .select('ll.keyid', 'll.employeeid', 'rl.username', 'll.browserInformation', 'll.loginTime', 'll.logoutTime',
                    'll.actualLogout', 'll.loggedout', 'll.forcedLogoutAt', 'll.forcedLogoutReason',
                    'fb.username as forcedLogoutByName', 'll.forcedLogoutBy')
               .select(db.raw('(COALESCE(ll.loggedout, 0) = 0 AND ll.logoutTime > NOW()) AS isActive'))
               .orderBy('ll.keyid', 'desc').limit(count).offset((page - 1) * count);
          if (employeeid) query.where('ll.employeeid', employeeid);
          const rows = await query;
          return rows.map((row: any) => ({ ...row, isActive: Number(row.isActive) === 1 }));
     }
}
