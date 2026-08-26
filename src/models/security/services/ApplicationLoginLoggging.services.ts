import { logger } from "../../commissions/commission-configurations";
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

     async initUserLoginSession(browserInformation: string): Promise<ILoginLog | undefined> {
          const service = this.ApplicationLoginLogRepo;
          const canInitiateLogin = await service.getCanInitiateLogin(this.employeeid);
          if (!canInitiateLogin) await service.destroyUserSessions(this.employeeid);
          const logId = await service.createHistoryLog(this.employeeid, browserInformation);
          return service.findHistoryLogById(logId);
     }

     async isEmployeeHaveActiveSession(): Promise<boolean> {
          {
               const activeSessions = await this.ApplicationLoginLogRepo.getCanInitiateLogin(this.employeeid);
               return activeSessions === false ? true : false;
          }
     }
}