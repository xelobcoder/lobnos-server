import { logger } from "../../commissions/commission-configurations";
import KnexConnection from "../../../database/KnexConnections";
import { ILoginLog } from "../entities/loginlogs.entities";
import { ApplicationLoginLog } from "../repositories/loginlog.repo";
import { StaffClientType } from "../deviceManagerSession";

export class ApplicationLoginLoggingService {
     private loginLogs: ILoginLog[] = [];
     private ApplicationLoginLogRepo: ApplicationLoginLog;

     constructor(private employeeid: number, private tenantId: number) {
          this.employeeid = employeeid;
          this.tenantId = tenantId;
          this.ApplicationLoginLogRepo = new ApplicationLoginLog(employeeid, tenantId);
     }
     
     async getCurrentUserLoginActiveSessions(): Promise<ILoginLog[]> {
          return this.ApplicationLoginLogRepo.getCurrentUserLoginActiveSessions(this.employeeid);
     }

     /**
      * Browser logins replace other browser sessions. Restricted device-manager sessions
      * coexist with them; administrative revocation still closes either session type.
      */
     async initUserLoginSession(browserInformation: unknown, deviceFingerprint?: string | null, clientType: StaffClientType = 'standard', expectedPasswordHash?: string): Promise<ILoginLog | undefined> {
          const service = this.ApplicationLoginLogRepo;
          const connection = await KnexConnection(this.tenantId);
          const logId = await connection.transaction(async (trx) => {
               const account = await trx('roles').where('employeeid', this.employeeid).forUpdate().first('employeeid', 'password');
               // A reset may have committed after password validation but before this lock.
               if (expectedPasswordHash !== undefined && account?.password !== expectedPasswordHash) {
                    throw new Error('Credentials changed during sign-in. Please sign in again.');
               }
               if (clientType === 'standard') await service.destroyUserSessions(this.employeeid, trx, true);
               return service.createHistoryLog(this.employeeid, browserInformation as string, trx, deviceFingerprint, clientType);
          });
          return service.findHistoryLogById(logId);
     }

     async isEmployeeHaveActiveSession(): Promise<boolean> {
          {
               const activeSessions = await this.ApplicationLoginLogRepo.getCanInitiateLogin(this.employeeid);
               return activeSessions === false ? true : false;
          }
     }
}
