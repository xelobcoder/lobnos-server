import { Request, Response } from "express";
import { PrimeBillingCampaignRepo } from "../../models/billing/repositories/PrimeBillingCampaignRepo";

export class PrimeBillingCampaignController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const repo = new PrimeBillingCampaignRepo(tenantId);
               const id = await repo.create(req.body);
               return res.json({ status: typeof id == "string" ? 'error' : 'success', message: typeof id == "string" ? id : 'Campaign created successfully', id });
          } catch (error) {
               return res.status(500).json({ success: false, error: error.message });
          }
     }

     static async findById(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const id = parseInt(req.params.id, 10);
               const repo = new PrimeBillingCampaignRepo(tenantId);
               const campaign = await repo.findById(id);
               if (!campaign) return res.status(404).json({ success: false, error: "Not found" });
               return res.json({ success: true, campaign });
          } catch (error) {
               return res.status(500).json({ success: false, error: error.message });
          }
     }

     static async update(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const id = parseInt(req.params.id, 10);
               const repo = new PrimeBillingCampaignRepo(tenantId);
               await repo.update(id, req.body);
               return res.json({ success: true });
          } catch (error) {
               return res.status(500).json({ success: false, error: error.message });
          }
     }

     static async delete(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const id = parseInt(req.params.id, 10);
               const repo = new PrimeBillingCampaignRepo(tenantId);
               await repo.delete(id);
               return res.json({ success: true });
          } catch (error) {
               return res.status(500).json({ success: false, error: error.message });
          }
     }

     static async list(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const repo = new PrimeBillingCampaignRepo(tenantId);
               const campaigns = await repo.list();
               return res.json({ success: true, campaigns });
          } catch (error) {
               return res.status(500).json({ success: false, error: error.message });
          }
     }
}