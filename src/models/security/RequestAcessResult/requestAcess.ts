import KnexConnection from "../../../database/KnexConnections";
import Creator from "../../creator/creator";
import AccessWindowsRepo from "./accessWindowsRepo";
import ResultAccessTableRepo from "./resultAcessTableRepo";


interface AccessRequest {
     patientid: number;
     staffid: number;
     requestType: 'access' | 'edit';
     requestedAt: Date;
     status: 'pending' | 'granted' | 'revoked' | 'expired';
     ascensionid: number;
     grantedAt?: Date;
     revokedAt?: Date;
     employeeid: number;
     expiredAt?: Date;
     accessedAt?: Date;
     reason?: string;
     urgency?: 'low' | 'medium' | 'high' | 'critical';
}


const DEFAULT_WINDOW_PERIODS = {
     access: '24h',
     edit: '24h'
};

export default class RequestAccess {
     private static readonly TABLE_NAME = 'result_access_requests';

     private static async extractWindowPeriod(tenantId: number, ascensionid: number, requestType: 'access' | 'edit', staffid?: number): Promise<boolean | { windowPeriod: string, timestamp: Date, record: any, requireApproval: boolean }> {
          if (!ascensionid) throw new Error("Ascension ID is required to extract window period");
          const records = await Creator.getRecordedResultsUsingascensionId(tenantId, ascensionid);
          if (!Array.isArray(records) || records.length === 0 || !records[0]) return false;
          const record = records[0];
          const timestamp = new Date(record.updated_on || record.created_on || new Date())
          const window = staffid ? await AccessWindowsRepo.getEffectiveSettings(staffid) : await AccessWindowsRepo.findGlobalSettings();
          const windowPeriod = window ? (requestType === 'access' ? window['access_window'] : window["edit_window"]) : DEFAULT_WINDOW_PERIODS[requestType];
          const requireApproval = window ? window.require_approval : false;
          return { windowPeriod, timestamp, record, requireApproval };
     }

     static async verifyWindowPeriod(tenantId: number, ascensionid: number, staffid: number, requestType: 'access' | 'edit'): Promise<boolean> {
          const existingRequests = await ResultAccessTableRepo.findLatestByAscensionAndStaff(tenantId, ascensionid, staffid);

          if (existingRequests && existingRequests.status === 'granted') {
               const window = await AccessWindowsRepo.getEffectiveSettings(staffid) || await AccessWindowsRepo.findGlobalSettings();
               const windowPeriod = window ? (requestType === 'access' ? window['access_window'] : window["edit_window"]) : DEFAULT_WINDOW_PERIODS[requestType];
               if (!existingRequests.grantedAt) {
                    await ResultAccessTableRepo.expireAccess(tenantId, existingRequests.id);
                    return false;
               }

               const refinedPeriod = RequestAccess.convertWindowToDate(windowPeriod);
               const grantedTime = new Date(existingRequests.grantedAt).getTime();
               const currentTime = new Date().getTime();
               const expirationTime = grantedTime + refinedPeriod;

               if (expirationTime >= currentTime) {
                    if (requestType === 'edit') {
                         const extraction = await RequestAccess.extractWindowPeriod(tenantId, ascensionid, requestType, staffid);
                         if (extraction && typeof extraction !== "boolean") {
                              const { record } = extraction;
                              if (record && record.employeeid && record.employeeid !== existingRequests.staffid) {
                                   await ResultAccessTableRepo.expireAccess(tenantId, existingRequests.id);
                                   return false;
                              }
                         }
                    }
                    return true;
               } else {
                    await ResultAccessTableRepo.expireAccess(tenantId, existingRequests.id);
                    return false;
               }
          }

          if (!existingRequests) {
               const extraction = await RequestAccess.extractWindowPeriod(tenantId, ascensionid, requestType, staffid);
               if (!extraction || typeof extraction === "boolean") return false;
               const { windowPeriod, timestamp } = extraction;
               const refinedPeriod = RequestAccess.convertWindowToDate(windowPeriod);
               const refinedTimestamp = new Date(timestamp).getTime() + refinedPeriod;

               return refinedTimestamp >= new Date().getTime();
          }
          return false;
     }

     private static convertWindowToDate(windowPeriod: string) {
          if (windowPeriod.endsWith('h')) {
               return parseInt(windowPeriod.replace('h', '')) * 60 * 60 * 1000;
          } else if (windowPeriod.endsWith('d')) {
               return parseInt(windowPeriod.replace('d', '')) * 24 * 60 * 60 * 1000;
          } else if (windowPeriod.endsWith('w')) {
               return parseInt(windowPeriod.replace('w', '')) * 7 * 24 * 60 * 60 * 1000;
          } else if (windowPeriod.endsWith('m')) {
               return parseInt(windowPeriod.replace('m', '')) * 30 * 24 * 60 * 60 * 1000;
          } else {
               return 24 * 60 * 60 * 1000;
          }
     }

     static async requestPermission(tenantId: number, request: Omit<AccessRequest, 'requestedAt' | 'status'>): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const [id] = await connection(this.TABLE_NAME).insert({
               ...request,
               requestedAt: new Date(),
               status: 'pending'
          });
          return id;
     }



     static async getAccessHistory(
          tenantId: number,
          patientid?: number,
          staffid?: number,
          urgency?: 'low' | 'medium' | 'high' | 'critical',
          count?: number,
          page?: number,
          sortby?: 'asc' | 'desc',
          ascensionid?: number
     ): Promise<AccessRequest[]> {
          const connection = await KnexConnection(tenantId);
          const query = connection(this.TABLE_NAME)
               .select([
                    `${this.TABLE_NAME}.*`,
                    'roles.username',
                    'roles.email',
                    'roles.role as employee_role',
                    'new_patients.fullpatientid'
               ])
               .leftJoin('roles', `${this.TABLE_NAME}.staffid`, 'roles.employeeid')
               .leftJoin('new_patients', `${this.TABLE_NAME}.patientid`, 'new_patients.patientid');

          if (patientid) query.where(`${this.TABLE_NAME}.patientid`, patientid);
          if (staffid) query.where(`${this.TABLE_NAME}.staffid`, staffid);
          if (urgency) query.where(`${this.TABLE_NAME}.urgency`, urgency);
          if (ascensionid) query.where(`${this.TABLE_NAME}.ascensionid`, ascensionid);

          if (sortby) {
               query.orderBy(`${this.TABLE_NAME}.requestedAt`, sortby);
          }

          if (count && page) {
               query.limit(count).offset((page - 1) * count);
          }

          return await query;
     }

     static async expireExpiredRequests(tenantId: number): Promise<void> {
          const pendingRequests = await ResultAccessTableRepo.findAll(tenantId, { status: 'pending' });
          for (const request of pendingRequests) {
               const isValid = await RequestAccess.verifyWindowPeriod(tenantId, request.ascensionid, request.staffid, request.requestType);
               if (!isValid) {
                    await ResultAccessTableRepo.expireAccess(tenantId, request.id);
               }
          }
          const grantedRequests = await ResultAccessTableRepo.findAll(tenantId, { status: 'granted' });
          for (const request of grantedRequests) {
               const isValid = await RequestAccess.verifyWindowPeriod(tenantId, request.ascensionid, request.staffid, request.requestType);
               if (!isValid) {
                    await ResultAccessTableRepo.expireAccess(tenantId, request.id);
               }
          }
     }
}