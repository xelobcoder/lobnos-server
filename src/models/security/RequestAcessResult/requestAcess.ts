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
     expiredAt?: Date;
     accessedAt?: Date;
}


const DEFAULT_WINDOW_PERIODS = {
     access: '24h',
     edit: '1h'
};

export default class RequestAccess {
     private static readonly TABLE_NAME = 'result_access_requests';

     private static async extractWindowPeriod(tenantId: number, ascensionid: number, requestType: 'access' | 'edit', staffid?: number): Promise<boolean | { windowPeriod: string, timestamp: Date, record: any, requireApproval: boolean }> {
          if (!ascensionid) throw new Error("Ascension ID is required to extract window period");
          const records = Creator.getRecordedResultsUsingServicedId(tenantId, ascensionid);
          if (Array.isArray(records) && records.length === 0) return false;
          const record = records[0];
          const timestamp = record.updated_on ? record.updated_on : record.created_on;

          // Get effective settings (employee-specific or global)
          const window = staffid ? await AccessWindowsRepo.getEffectiveSettings(staffid) : await AccessWindowsRepo.findGlobalSettings();
          const windowPeriod = window ? (requestType === 'access' ? window['access_window'] : window["edit_window"]) : DEFAULT_WINDOW_PERIODS[requestType];
          const requireApproval = window ? window.require_approval : false;

          return { windowPeriod, timestamp, record, requireApproval };
     }

     static async verifyWindowPeriod(tenantId: number, ascensionid: number, staffid: number, requestType: 'access' | 'edit'): Promise<boolean> {
          const existingRequests = await ResultAccessTableRepo.findLatestByAscensionAndStaff(tenantId, ascensionid, staffid);
          if (existingRequests && existingRequests.status === 'granted') {
               const extraction = await RequestAccess.extractWindowPeriod(tenantId, ascensionid, requestType, staffid);
               if (!extraction || typeof extraction === "boolean") {
                    await ResultAccessTableRepo.expireAccess(tenantId, existingRequests.id);
                    return false;
               }
               const { windowPeriod, timestamp, record, requireApproval } = extraction;
               if (requestType === 'edit' && record.employeeid !== existingRequests.staffid) {
                    await ResultAccessTableRepo.expireAccess(tenantId, existingRequests.id);
                    return false;
               }
               const refinedPeriod = RequestAccess.convertWindowToDate(windowPeriod);
               const expirationTime = new Date(timestamp).getTime() + refinedPeriod;
               if (expirationTime >= new Date().getTime()) {
                    return true;
               } else {
                    await ResultAccessTableRepo.expireAccess(tenantId, existingRequests.id);
                    return false;
               }
          }

          const extraction = await RequestAccess.extractWindowPeriod(tenantId, ascensionid, requestType, staffid);
          if (!extraction || typeof extraction === "boolean") return false;
          const { windowPeriod, timestamp } = extraction;
          const refinedPeriod = RequestAccess.convertWindowToDate(windowPeriod);
          const refinedTimestamp = new Date(timestamp).getTime() + refinedPeriod;
          return refinedTimestamp >= new Date().getTime();
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



     static async getAccessHistory(tenantId: number, patientid?: number, staffid?: number, count?: number, page?: number): Promise<AccessRequest[]> {
          const connection = await KnexConnection(tenantId);
          let query = connection(this.TABLE_NAME).select('*');
          if (patientid) query = query.where('patientid', patientid);
          if (staffid) query = query.where('staffid', staffid);
          if (count) query = query.limit(count);
          if (page) query = query.offset((page - 1) * (count || 20));
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