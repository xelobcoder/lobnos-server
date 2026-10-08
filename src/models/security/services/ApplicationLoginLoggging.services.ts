import { logger } from "../../commissions/commission-configurations";
import KnexConnection from "../../../database/KnexConnections";
import { ILoginLog } from "../entities/loginlogs.entities";
import { ApplicationLoginLog } from "../repositories/loginlog.repo";

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
      * Starts the only valid session for this user: every other open session (other browsers/devices)
      * is closed in the same transaction, so their tokens are rejected on the next request.
      */
     async initUserLoginSession(browserInformation: unknown, deviceFingerprint?: string | null): Promise<ILoginLog | undefined> {
          const service = this.ApplicationLoginLogRepo;
          const connection = await KnexConnection(this.tenantId);
          const logId = await connection.transaction(async (trx) => {
               await service.destroyUserSessions(this.employeeid, trx);
               return service.createHistoryLog(this.employeeid, browserInformation as string, trx, deviceFingerprint);
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