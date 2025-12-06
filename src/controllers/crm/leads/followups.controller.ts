import { Request, Response } from 'express';
import { LeadFollowUpsRepo } from '../../../models/customers/leads/followups';
import { LeadFollowUp } from '../../../models/customers/leads/dev/types';
import { customError } from '../../../hooks/helper';

export const createFollowUp = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const followUpData = req.body;
          const newFollowUp = await repo.create(followUpData);
          res.status(201).json({ success: true, data: newFollowUp });
     } catch (error: any) {
          console.error('Create follow-up error:', error);
          customError('Failed to create follow-up', 400, res);
     }
};

export const updateFollowUp = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const id = parseInt(req.params.id);
          const updates = req.body;
          const updatedRows = await repo.update(id, updates);
          if (updatedRows > 0) {
               res.status(200).json({ success: true, message: 'Follow-up updated successfully' });
          } else {
               customError('Follow-up not found', 404, res);
          }
     } catch (error) {
          console.error('Update follow-up error:', error);
          customError('Failed to update follow-up', 400, res);
     }
};

export const getAllFollowUps = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const page = parseInt(req.query.page as string) || 1;
          const count = parseInt(req.query.count as string) || 10;
          const sortby = req.query.sortby as "DESC" | "ASC" || "DESC";
          const withlead = req.query.withlead === 'true';
          const data = await repo.findAllPaginated(page, count, sortby, withlead);
          res.status(200).json({ success: true, ... data });
     } catch (error) {
          console.error('Get all follow-ups error:', error);
          customError('Failed to fetch follow-ups', 500, res);
     }
};

export const getFollowUpById = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const id = parseInt(req.params.id);
          const followUp = await repo.findById(id);
          if (followUp) {
               res.status(200).json({ success: true, data: followUp });
          } else {
               customError('Follow-up not found', 404, res);
          }
     } catch (error) {
          console.error('Get follow-up by ID error:', error);
          customError('Failed to fetch follow-up', 500, res);
     }
};

export const getFollowUpsByLeadId = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const leadId = parseInt(req.params.leadId);
          const followUps = await repo.findByLeadId(leadId);
          res.status(200).json({ success: true, data: followUps });
     } catch (error) {
          console.error('Get follow-ups by lead ID error:', error);
          customError('Failed to fetch follow-ups for lead', 500, res);
     }
};

export const getFollowUpsByStatus = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const status = req.params.status as LeadFollowUp['status'];
          const followUps = await repo.findByStatus(status);
          res.status(200).json({ success: true, data: followUps });
     } catch (error) {
          console.error('Get follow-ups by status error:', error);
          customError('Failed to fetch follow-ups by status', 500, res);
     }
};

export const getPendingFollowUps = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const followUps = await repo.findPendingFollowups();
          res.status(200).json({ success: true, data: followUps });
     } catch (error) {
          console.error('Get pending follow-ups error:', error);
          customError('Failed to fetch pending follow-ups', 500, res);
     }
};

export const deleteFollowUp = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeadFollowUpsRepo(tenantId);
          const id = parseInt(req.params.id);
          const deletedRows = await repo.delete(id);
          if (deletedRows > 0) {
               res.status(200).json({ success: true, message: 'Follow-up deleted successfully' });
          } else {
               customError('Follow-up not found', 404, res);
          }
     } catch (error) {
          console.error('Delete follow-up error:', error);
          customError('Failed to delete follow-up', 500, res);
     }
};