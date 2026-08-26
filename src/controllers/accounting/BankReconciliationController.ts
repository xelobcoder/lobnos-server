import { NextFunction, Request, Response } from 'express';
import { BankReconciliationService } from '../../accountingModule/services/BankReconciliationService';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
import { getAuthUser } from '../../middleware/authority';
import { customError } from '../../hooks/helper';
import multer from 'multer';

export const bankExcelUpload = multer({
     storage: multer.memoryStorage(),
     limits: { fileSize: 10 * 1024 * 1024 },
     fileFilter: (_request, file, callback) => {
          if (/\.xlsx$/i.test(file.originalname)) return callback(null, true);
          return callback(new Error('Only .xlsx Excel workbooks are accepted'));
     },
});

export function parseBankExcelUpload(req: Request, res: Response, next: NextFunction) {
     bankExcelUpload.single('file')(req, res, (error: any) => {
          if (!error) return next();
          const statusCode = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
          return res.status(statusCode).json({
               status: 'error',
               statusCode,
               message: error.message || 'Invalid Excel upload',
          });
     });
}

function tenantOf(req: Request): number {
     return getAuthUser(req)?.tenantId || parseInt(req.query.tenantId as string) || 1;
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
     return customError(error?.message || 'Bank reconciliation request failed', 500, response);
}

function ok(response: Response, result: any, statusCode = 200) {
     return response.status(statusCode).json({ status: 'success', statusCode, result });
}

export class BankReconciliationController {
     static async listAccounts(req: Request, res: Response) {
          try {
               return ok(res, await new BankReconciliationService(tenantOf(req)).listAccounts());
          } catch (error) {
               return handle(error, res);
          }
     }

     static async createAccount(req: Request, res: Response) {
          try {
               const { name, bank_name, account_number, gl_account_code, branchid } = req.body || {};
               if (!name || !gl_account_code) return customError('name and gl_account_code are required', 400, res);

               const service = new BankReconciliationService(tenantOf(req));
               return ok(res, await service.createAccount({ name, bank_name, account_number, gl_account_code, branchid }), 201);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async updateAccount(req: Request, res: Response) {
          try {
               const { name, bank_name, account_number, gl_account_code, branchid, is_active } = req.body || {};
               const service = new BankReconciliationService(tenantOf(req));

               return ok(
                    res,
                    await service.updateAccount(Number(req.params.id), {
                         name,
                         bank_name,
                         account_number,
                         gl_account_code,
                         branchid,
                         is_active,
                    })
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async importStatement(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               const { bankAccountId, lines } = req.body || {};
               if (!bankAccountId || !Array.isArray(lines) || lines.length === 0) {
                    return customError('bankAccountId and at least one line are required', 400, res);
               }

               const service = new BankReconciliationService(tenantOf(req));
               return ok(
                    res,
                    await service.importStatement({
                         bankAccountId: Number(bankAccountId),
                         importedBy: user?.employeeid || 0,
                         lines,
                    }),
                    201
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async importExcel(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               const bankAccountId = Number(req.body?.bankAccountId);
               if (!bankAccountId || !req.file) {
                    return customError('bankAccountId and an .xlsx file are required', 400, res);
               }

               const service = new BankReconciliationService(tenantOf(req));
               return ok(
                    res,
                    await service.importExcel({
                         bankAccountId,
                         importedBy: user?.employeeid || 0,
                         buffer: req.file.buffer,
                    }),
                    201
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async statementLines(req: Request, res: Response) {
          try {
               const service = new BankReconciliationService(tenantOf(req));
               return ok(
                    res,
                    await service.statementLines(Number(req.params.bankAccountId), {
                         from: req.query.from as string | undefined,
                         to: req.query.to as string | undefined,
                         status: req.query.status as string | undefined,
                         page: Number(req.query.page) || 1,
                         count: Number(req.query.count) || 50,
                    })
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async unmatchedLedger(req: Request, res: Response) {
          try {
               const service = new BankReconciliationService(tenantOf(req));
               return ok(
                    res,
                    await service.unmatchedLedgerLines(
                         Number(req.params.bankAccountId),
                         req.query.from as string | undefined,
                         req.query.to as string | undefined
                    )
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async suggestMatches(req: Request, res: Response) {
          try {
               const service = new BankReconciliationService(tenantOf(req));
               return ok(
                    res,
                    await service.suggestMatches(
                         Number(req.params.bankAccountId),
                         req.query.from as string | undefined,
                         req.query.to as string | undefined,
                         req.query.dayTolerance ? Number(req.query.dayTolerance) : undefined
                    )
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async match(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               const { statementLineId, journalLineId } = req.body || {};
               if (!statementLineId || !journalLineId) {
                    return customError('statementLineId and journalLineId are required', 400, res);
               }

               const service = new BankReconciliationService(tenantOf(req));
               await service.match(Number(statementLineId), Number(journalLineId), user?.employeeid || 0);
               return ok(res, { matched: true });
          } catch (error) {
               return handle(error, res);
          }
     }

     static async matchMany(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               const pairs = req.body?.pairs;
               if (!Array.isArray(pairs)) return customError('pairs is required', 400, res);

               const service = new BankReconciliationService(tenantOf(req));
               let matched = 0;
               const failures: any[] = [];

               for (const pair of pairs) {
                    try {
                         await service.match(Number(pair.statementLineId), Number(pair.journalLineId), user?.employeeid || 0);
                         matched++;
                    } catch (error: any) {
                         failures.push({ pair, reason: error?.message });
                    }
               }

               return ok(res, { matched, failures });
          } catch (error) {
               return handle(error, res);
          }
     }

     static async unmatch(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               const service = new BankReconciliationService(tenantOf(req));
               await service.unmatch(Number(req.params.id), user?.employeeid || 0);
               return ok(res, { unmatched: true });
          } catch (error) {
               return handle(error, res);
          }
     }

     static async ignore(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               const service = new BankReconciliationService(tenantOf(req));
               await service.ignore(Number(req.params.id), user?.employeeid || 0);
               return ok(res, { ignored: true });
          } catch (error) {
               return handle(error, res);
          }
     }

     static async summary(req: Request, res: Response) {
          try {
               const asOf = (req.query.asOf as string) || new Date().toISOString().split('T')[0];
               const statementBalance = Number(req.query.statementBalance || 0);

               const service = new BankReconciliationService(tenantOf(req));
               return ok(res, await service.summary(Number(req.params.bankAccountId), asOf, statementBalance));
          } catch (error) {
               return handle(error, res);
          }
     }
}
