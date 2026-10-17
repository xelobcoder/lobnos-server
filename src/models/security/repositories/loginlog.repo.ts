import KnexConnection from "../../../database/KnexConnections";
import { IApplicationLoginLog } from "../interface/IApplicationLoginLog";
import { ILoginLog } from "../entities/loginlogs.entities";
import crypto from 'node:crypto';
import { DEVICE_MANAGER_SESSION_PREFIX, StaffClientType } from '../deviceManagerSession';

export class ApplicationLoginLog implements IApplicationLoginLog {
     private employeeid: number;
     private tenantId: number;
     private connection: any;
     private tableName: string;

     private loginDuration: number;
     constructor(employeeid: number, tenantId: number, loginDuration: number =8) {
          this.employeeid = employeeid;
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
          this.tableName = 'loginlogs';
          this.loginDuration = loginDuration;
     }

     createLogOutTime() {
          return crypto.randomUUID();
     }

     async createHistoryLog(employeeid: number, browserInformation: string, trx?: any, deviceFingerprint?: string | null, clientType: StaffClientType = 'standard'): Promise<number> {
          const connection = trx ? await trx : await this.connection;
          const row: Record<string, unknown> = {
               employeeid,
               loginSessionId: (clientType === 'device-manager' ? DEVICE_MANAGER_SESSION_PREFIX : '') + this.createLogOutTime(),
               browserInformation: typeof browserInformation === 'string' ? browserInformation : JSON.stringify(browserInformation),
               logoutTime: new Date(Date.now() + this.loginDuration * 60 * 60 * 1000),
          };
          if (deviceFingerprint && await this.hasDeviceFingerprintColumn()) {
               row.deviceFingerprint = deviceFingerprint;
          }
          const insert = await connection(this.tableName).insert(row).returning('keyid');
          return insert[0];
     }

     private static fingerprintColumnCache = new Map<number, boolean>();

     private async hasDeviceFingerprintColumn(): Promise<boolean> {
          const cached = ApplicationLoginLog.fingerprintColumnCache.get(this.tenantId);
          if (cached !== undefined) return cached;
          const connection = await this.connection;
          const exists = await connection.schema.hasColumn(this.tableName, 'deviceFingerprint');
          if (exists) ApplicationLoginLog.fingerprintColumnCache.set(this.tenantId, true);
          return exists;
     }


    async findHistoryLogById(id: number): Promise<ILoginLog | undefined> {
          const connection = await this.connection;
          return connection(this.tableName)
               .where("keyid", id)
               .first();
     }



     async findSessionById(employeeid: number, loginSessionId: string): Promise<ILoginLog | undefined> {
          const connection = await this.connection;
          return connection(this.tableName)
               .where('employeeid', employeeid)
               .andWhere('loginSessionId', loginSessionId)
               .first();
     }


     async findActiveSessionById(employeeid: number, loginSessionId: string): Promise<ILoginLog | undefined> {
          const connection = await this.connection;
          return connection(this.tableName)
               .where('employeeid', employeeid)
               .andWhere('loginSessionId', loginSessionId)
               .andWhere('logoutTime', '>', new Date())
               .first();
     }


     async findActiveSessions(employeeid: number, filter?: { page: number, count: number }): Promise<ILoginLog[]> {
          const connection = await this.connection;
          const query = await connection(this.tableName)
               .where('employeeid', employeeid)
               .andWhere('logoutTime', '>', new Date())
               .limit(filter?.count ?? 10)
               .offset(((filter?.page ?? 1) - 1) * (filter?.count ?? 10))
               .select('*');
          return await query;
     }

     async updateHistoryLog(employeeid: number, tenantId: number, loginSessionId: string, logoutTime: Date, actualLogout: Date, loggedout: boolean, trx?: any): Promise<void> {
          const connection = await this.connection(trx);
          const update = await connection(this.tableName)
               .where('employeeid', employeeid)
               .andWhere('loginSessionId', loginSessionId)
               .update({
                    logoutTime,
                    actualLogout,
                    loggedout,
                    updatedAt: new Date(),
               });
          return update;
     }


     async getCanInitiateLogin(employeeid: number): Promise<boolean> {
          const connection = await this.connection;
          const query = await connection(this.tableName)
               .where('employeeid', employeeid)
               .andWhere('logoutTime', '>', new Date())
               .count('keyid as count')
               .first();
          return query.count === 0;
     }


     async getCurrentUserLoginActiveSessions(employeeid: number): Promise<ILoginLog[]> {
          const connection = await this.connection;
          const query = await connection(this.tableName)
               .where('employeeid', employeeid)
               .andWhere('logoutTime', '>', new Date())
               .select('*');
          return await query;
     }


     async getCurrentUserLoginSessions(employeeid: number, filter?: { page: number, count: number }): Promise<ILoginLog[]> {
          const connection = await this.connection;
          const query = await connection(this.tableName)
               .where('employeeid', employeeid)
               .limit(filter?.count ?? 10)
               .offset(((filter?.page ?? 1) - 1) * (filter?.count ?? 10))
               .select('*');
          return await query;
     }


     async getCurrentUserLoginSessionsWithDetails(employeeid: number): Promise<ILoginLog[]> {
          const connection = await this.connection;
          const query = await connection(this.tableName)
               .leftJoin('roles', 'loginlogs.employeeid', 'roles.employeeid')
               .where('employeeid', employeeid)
               .select('loginlogs.*', 'roles.firstname', 'roles.lastname', 'roles.email', 'roles.role', 'roles.employeeid', 'roles.middlename', 'roles.designation');
          return await query;
     }




     async destroyUserSessions(employeeid: number, trx?: any, preserveDeviceManager = false): Promise<boolean | undefined> {
          const connection = trx ? await trx : await this.connection;
          const query = connection(this.tableName)
               .update({ logoutTime: new Date(), loggedout: true })
               .where('employeeid', employeeid)
               .andWhere('logoutTime', '>', new Date());
          if (preserveDeviceManager) query.whereNot('loginSessionId', 'like', `${DEVICE_MANAGER_SESSION_PREFIX}%`);
          const result = await query;
          return result > 0;
     }


     async getCurrentLoginCounts(employeeid: number): Promise<number> {
          const connection = await this.connection;
          const query = await connection(this.tableName)
               .where('employeeid', employeeid)
               .andWhere('logoutTime', '>', new Date())
               .count('keyid as count')
               .first();
          return (await query).count;
     }

}