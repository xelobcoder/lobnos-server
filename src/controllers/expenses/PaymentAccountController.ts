import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { PaymentAccountService } from '../../models/Expenses/PaymentAccountService';

export class PaymentAccountController {
     static async managementOptions(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               response.json({ success: true, data: await new PaymentAccountService(actor.tenantId).managementOptions(actor) });
          } catch (error: any) {
               response.status(500).json({ success: false, message: error.message || 'Unable to load payment-account options' });
          }
     }

     static async listAvailable(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request);
               if (!actor) {
                    response.status(401).json({ success: false, message: 'Authentication required' });
                    return;
               }
               const capability = request.query.capability === 'pay' ? 'pay' : 'view';
               const accounts = await new PaymentAccountService(actor.tenantId).listAvailable(actor, capability);
               response.json({ success: true, data: accounts });
          } catch (error: any) {
               response.status(500).json({ success: false, message: error.message || 'Unable to load payment accounts' });
          }
     }

     static async listAll(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const requestedBranch = request.query.branchid === undefined ? actor.branch : Number(request.query.branchid);
               const accounts = await new PaymentAccountService(actor.tenantId).listAll(requestedBranch);
               response.json({ success: true, data: accounts });
          } catch (error: any) {
               response.status(500).json({ success: false, message: error.message || 'Unable to load payment accounts' });
          }
     }

     static async create(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const account = await new PaymentAccountService(actor.tenantId).create(actor, {
                    name: request.body?.name,
                    accountType: request.body?.account_type ?? request.body?.accountType,
                    currency: request.body?.currency,
                    branchid: request.body?.branchid,
                    glAccountCode: request.body?.gl_account_code ?? request.body?.glAccountCode,
                    bankAccountId: request.body?.bank_account_id ?? request.body?.bankAccountId,
               });
               response.status(201).json({ success: true, data: account });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : /already exists/i.test(error.message) ? 409 : 400).json({ success: false, message: error.message });
          }
     }

     static async grantAccess(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const access = await new PaymentAccountService(actor.tenantId).grantAccess(actor, Number(request.params.id), {
                    employeeid: Number(request.body?.employeeid),
                    canPay: request.body?.can_pay ?? request.body?.canPay,
                    canView: request.body?.can_view ?? request.body?.canView,
                    canReconcile: request.body?.can_reconcile ?? request.body?.canReconcile,
               });
               response.json({ success: true, data: access });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 400).json({ success: false, message: error.message });
          }
     }
}
