import { Request, Response } from 'express';
import { customError, responseError } from '../../hooks/helper';
import { StaffFocService } from '../../models/foc/services/StaffFocService';
import { getAuthUser } from '../../middleware/authority';

export class StaffFocController {
     private static getService(): StaffFocService {
          return new StaffFocService();
     }

     static async getAccountBalance(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const employeeParam = Array.isArray(req.params.employeeid) ? req.params.employeeid[0] : req.params.employeeid;
               const employeeId = parseInt(employeeParam, 10);
               const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

               if (!tenantId || isNaN(employeeId)) {
                    return customError('Valid tenantId and employeeid are required', 400, res);
               }

               const service = StaffFocController.getService();
               const account = await service.getStaffAccount(tenantId, employeeId, year);
               res.send({ status: 'success', result: account });
          } catch (err) {
               responseError(res);
          }
     }

     static async validateCoverage(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const { employeeid, patientid, grossAmount, year } = req.body;

               if (!tenantId || !employeeid || !patientid || grossAmount === undefined) {
                    return customError('tenantId, employeeid, patientid, and grossAmount are required', 400, res);
               }

               const service = StaffFocController.getService();
               const validation = await service.validateFocCoverage(
                    tenantId,
                    parseInt(employeeid, 10),
                    parseInt(patientid, 10),
                    parseFloat(grossAmount),
                    year ? parseInt(year, 10) : undefined
               );

               res.send({ status: 'success', result: validation });
          } catch (err) {
               responseError(res);
          }
     }

     static async processTransaction(req: Request, res: Response) {
          try {
               const actor = getAuthUser(req);
               if (!actor) return customError('Authentication required', 401, res);
               const { employeeid, patientid, billingid, branchid, gross_amount, reason, allow_override } = req.body;

               if (!employeeid || !patientid || !billingid || !gross_amount) {
                    return customError('employeeid, patientid, billingid, and gross_amount are required', 400, res);
               }

               const service = StaffFocController.getService();
               const tx = await service.processFocTransaction(actor.tenantId, {
                    employeeid: parseInt(employeeid, 10),
                    patientid: parseInt(patientid, 10),
                    billingid: parseInt(billingid, 10),
                    branchid: branchid ? parseInt(branchid, 10) : 1,
                    gross_amount: parseFloat(gross_amount),
                    requested_by: actor.employeeid,
                    reason: reason ? String(reason) : undefined,
                    allow_override: Boolean(allow_override),
               });

               res.send({ status: 'success', message: 'Staff FOC transaction recorded successfully', result: tx });
          } catch (err: any) {
               customError(err?.message || 'Failed to process FOC transaction', 400, res);
          }
     }

     static async approveTransaction(req: Request, res: Response) {
          try {
               const actor = getAuthUser(req);
               if (!actor) return customError('Authentication required', 401, res);
               const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
               const transactionId = /^\d+$/.test(idParam) ? Number(idParam) : NaN;

               if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
                    return customError('Valid transactionId is required', 400, res);
               }

               const service = StaffFocController.getService();
               await service.approveFocTransaction(actor.tenantId, transactionId, actor.employeeid);

               res.send({ status: 'success', message: 'FOC transaction approved successfully' });
          } catch (err: any) {
               customError(err?.message || 'Failed to approve FOC transaction', 400, res);
          }
     }

     static async reverseTransaction(req: Request, res: Response) {
          try {
               const actor = getAuthUser(req);
               if (!actor) return customError('Authentication required', 401, res);
               const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
               const transactionId = /^\d+$/.test(idParam) ? Number(idParam) : NaN;
               const { reason } = req.body;

               if (!Number.isSafeInteger(transactionId) || transactionId <= 0 || !reason) {
                    return customError('Valid transactionId and reason are required', 400, res);
               }

               const service = StaffFocController.getService();
               await service.reverseFocTransaction(actor.tenantId, transactionId, actor.employeeid, String(reason));

               res.send({ status: 'success', message: 'FOC transaction reversed successfully' });
          } catch (err: any) {
               customError(err?.message || 'Failed to reverse FOC transaction', 400, res);
          }
     }

     static async updateLimit(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const employeeParam = Array.isArray(req.params.employeeid) ? req.params.employeeid[0] : req.params.employeeid;
               const employeeId = parseInt(employeeParam, 10);
               const { newLimit, year } = req.body;

               if (!tenantId || isNaN(employeeId) || newLimit === undefined) {
                    return customError('tenantId, employeeid, and newLimit are required', 400, res);
               }

               const service = StaffFocController.getService();
               await service.updateStaffLimit(tenantId, employeeId, parseFloat(newLimit), year ? parseInt(year, 10) : undefined);

               res.send({ status: 'success', message: 'Staff FOC limit updated successfully' });
          } catch (err: any) {
               customError(err?.message || 'Failed to update staff limit', 400, res);
          }
     }

     static async getAllAccounts(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
               const search = req.query.search ? String(req.query.search) : undefined;
               const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
               const count = req.query.count ? parseInt(req.query.count as string, 10) : 10;

               if (!tenantId) {
                    return customError('tenantId is required', 400, res);
               }

               const service = StaffFocController.getService();
               const result = await service.getAllAccounts(tenantId, year, search, page, count);

               res.send({ status: 'success', result });
          } catch (err) {
               responseError(res);
          }
     }

     static async getTransactions(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const employeeid = req.query.employeeid ? parseInt(req.query.employeeid as string, 10) : undefined;
               const patientid = req.query.patientid ? parseInt(req.query.patientid as string, 10) : undefined;
               const status = req.query.status ? String(req.query.status) : undefined;
               const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
               const from = req.query.from ? String(req.query.from) : undefined;
               const to = req.query.to ? String(req.query.to) : undefined;
               const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
               const count = req.query.count ? parseInt(req.query.count as string, 10) : 10;

               if (!tenantId) {
                    return customError('tenantId is required', 400, res);
               }

               const service = StaffFocController.getService();
               const result = await service.getTransactions(tenantId, {
                    employeeid,
                    patientid,
                    status,
                    year,
                    from,
                    to,
                    page,
                    count,
               });

               res.send({ status: 'success', result });
          } catch (err) {
               responseError(res);
          }
     }

     static async getSummaryReport(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
               const branchId = req.query.branchid ? parseInt(req.query.branchid as string, 10) : undefined;

               if (!tenantId) {
                    return customError('tenantId is required', 400, res);
               }

               const service = StaffFocController.getService();
               const report = await service.getFocSummaryReport(tenantId, year, branchId);

               res.send({ status: 'success', result: report });
          } catch (err) {
               responseError(res);
          }
     }
}
