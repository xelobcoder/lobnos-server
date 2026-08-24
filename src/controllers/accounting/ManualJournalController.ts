import { Request, Response } from 'express';
import { ManualJournalService } from '../../accountingModule/services/ManualJournalService';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
import { customError } from '../../hooks/helper';

function getTenantId(req: Request): number {
     return parseInt(req.query.tenantId as string) || 1;
}

function handle(error: any, response: Response) {
     if (error instanceof AccountingError) {
          return response.status(error.statusCode).json({
               status: 'error',
               statusCode: error.statusCode,
               message: error.message,
               code: error.code,
          });
     }
     return customError(error?.message || 'Manual journal request failed', 500, response);
}

function ok(response: Response, result: any, statusCode = 200) {
     return response.status(statusCode).json({ status: 'success', statusCode, result });
}

export class ManualJournalController {
     static async create(req: Request, res: Response) {
          try {
               const { journalDate, description, reference, notes, lines, employeeid } = req.body || {};
               if (!journalDate || !description) {
                    return customError('journalDate and description are required', 400, res);
               }

               const service = new ManualJournalService(getTenantId(req));
               const journal = await service.create({
                    journalDate,
                    description,
                    reference,
                    notes,
                    createdBy: employeeid,
                    lines: lines || [],
               });
               return ok(res, journal, 201);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async update(req: Request, res: Response) {
          try {
               const { journalDate, description, reference, notes, lines } = req.body || {};
               const service = new ManualJournalService(getTenantId(req));
               const journal = await service.update(Number(req.params.id), {
                    journalDate,
                    description,
                    reference,
                    notes,
                    lines: lines || [],
               });
               return ok(res, journal);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async submit(req: Request, res: Response) {
          try {
               const employeeid = Number(req.body?.employeeid);
               if (!employeeid) return customError('employeeid is required', 400, res);

               const service = new ManualJournalService(getTenantId(req));
               return ok(res, await service.submit(Number(req.params.id), employeeid));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async approve(req: Request, res: Response) {
          try {
               const employeeid = Number(req.body?.employeeid);
               if (!employeeid) return customError('employeeid is required', 400, res);

               const service = new ManualJournalService(getTenantId(req));
               return ok(res, await service.approve(Number(req.params.id), employeeid));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async post(req: Request, res: Response) {
          try {
               const employeeid = Number(req.body?.employeeid);
               if (!employeeid) return customError('employeeid is required', 400, res);

               const service = new ManualJournalService(getTenantId(req));
               return ok(res, await service.post(Number(req.params.id), employeeid));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async reverse(req: Request, res: Response) {
          try {
               const employeeid = Number(req.body?.employeeid);
               if (!employeeid) return customError('employeeid is required', 400, res);

               const service = new ManualJournalService(getTenantId(req));
               return ok(res, await service.reverse(Number(req.params.id), employeeid, req.body?.description));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async voidJournal(req: Request, res: Response) {
          try {
               const employeeid = Number(req.body?.employeeid);
               if (!employeeid) return customError('employeeid is required', 400, res);

               const service = new ManualJournalService(getTenantId(req));
               return ok(res, await service.void(Number(req.params.id), employeeid, req.body?.reason));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async findById(req: Request, res: Response) {
          try {
               const service = new ManualJournalService(getTenantId(req));
               const journal = await service.findById(Number(req.params.id));
               if (!journal) return customError('Manual journal not found', 404, res);
               return ok(res, journal);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async list(req: Request, res: Response) {
          try {
               const service = new ManualJournalService(getTenantId(req));
               return ok(
                    res,
                    await service.list({
                         status: req.query.status as any,
                         from: req.query.from as string | undefined,
                         to: req.query.to as string | undefined,
                         page: Number(req.query.page) || 1,
                         count: Number(req.query.count) || 25,
                         sortby: req.query.sortby as string | undefined,
                    })
               );
          } catch (error) {
               return handle(error, res);
          }
     }
}
