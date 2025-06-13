import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';


export class AuditController {
  static async getAuditLogs(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.query.tenantId as string);
      if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
      const repo = new BillingStrategyRepository(tenantId);
      const conn = await repo['connection'];
      const audits = await conn('prime_billing_audit').select('*').orderBy('calculated_at', 'desc');
      res.json(audits);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}