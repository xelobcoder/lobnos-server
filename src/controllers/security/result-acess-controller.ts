import { Request, Response } from 'express';
import RequestAccess from '../../models/security/RequestAcessResult/requestAcess';
import ResultAccessTableRepo from '../../models/security/RequestAcessResult/resultAcessTableRepo';

export class ResultAccessController {
     static async requestAccess(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { patientid, staffid, requestType, ascensionid, reason, urgency } = req.body;
               if (!patientid || !staffid || !requestType || !ascensionid || !reason || !urgency) {
                    return res.status(400).json({
                         status: false,
                         error: 'Missing required fields in the request body'
                    });
               }
               const id = await RequestAccess.requestPermission(tenantId, { patientid, staffid, requestType, ascensionid, reason, urgency} as any);
               res.status(201).json({
                    status: true,
                    message: 'Access requested',
                    requestId: id
               });
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async grantAccess(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const requestId = req.params.requestId as string;
               const success = await ResultAccessTableRepo.grantAccess(tenantId, parseInt(requestId));
               if (success) {
                    res.json({
                         status: true,
                         message: 'Access granted'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Request not found'
                    });
               }
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async revokeAccess(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const requestId = req.params.requestId as string;
               const success = await ResultAccessTableRepo.revokeAccess(tenantId, parseInt(requestId));
               if (success) {
                    res.json({
                         status: true,
                         message: 'Access revoked'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Request not found'
                    });
               }
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getAccessHistory(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { patientid, staffid, urgency, page, count, sortby } = req.query;
               const history = await RequestAccess.getAccessHistory(
                    tenantId,
                    patientid ? parseInt(patientid as string) : undefined,
                    staffid ? parseInt(staffid as string) : undefined,
                    urgency as 'low' | 'medium' | 'high' | 'critical' | undefined,
                    count ? parseInt(count as string) : undefined,
                    page ? parseInt(page as string) : undefined,
                    sortby ? (sortby as string).toLowerCase() as 'asc' | 'desc' : undefined
               );
               res.json({
                    status: true,
                    data: history
               });
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async verifyAccess(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { ascensionid, staffid, requestType } = req.body;
               const allowed = await RequestAccess.verifyWindowPeriod(tenantId, ascensionid, staffid, requestType);
               res.json({
                    status: true,
                    allowed
               });
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async expireExpiredRequests(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               await RequestAccess.expireExpiredRequests(tenantId);
               res.json({
                    status: true,
                    message: 'Expired requests processed'
               });
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getAccessHistoryByAscensionAndEmployee(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               const { ascensionid, employeeid } = req.params;
               const { urgency, page, count, sortby } = req.query;
               const history = await RequestAccess.getAccessHistory(
                    tenantId,
                    undefined, 
                    parseInt(employeeid as string),
                    urgency as 'low' | 'medium' | 'high' | 'critical' | undefined,
                    count ? parseInt(count as string) : undefined,
                    page ? parseInt(page as string) : undefined,
                    sortby ? (sortby as string).toLowerCase() as 'asc' | 'desc' : undefined,
                    parseInt(ascensionid as string)
               );

               res.json({
                    status: true,
                    data: history
               });
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }
}
