import { Request, Response } from 'express';
import { CustomersLeads } from '../../../models/customers/leads/LeadRepository';
import { Lead } from '../../../models/customers/leads/dev/types';
import { customError } from '../../../hooks/helper';


export const createLead = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new CustomersLeads(tenantId);
          const leadData = req.body;
          const newLead = await repo.create(leadData);
          res.status(201).json({ success: true, data: newLead });
     } catch (error: any) {
          console.error('Create lead error:', error);
          if (error.message === 'A lead with this email address already exists') {
               customError(error.message, 409, res);
          } else {
               customError('Failed to create lead', 400, res);
          }
     }
};

export const updateLead = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new CustomersLeads(tenantId);
          const id = parseInt(req.params.id);
          const updates = req.body;
          const updatedRows = await repo.update(id, updates);
          if (updatedRows > 0) {
               res.status(200).json({ success: true, message: 'Lead updated successfully' });
          } else {
               customError('Lead not found', 404, res);
          }
     } catch (error) {
          console.error('Update lead error:', error);
          customError('Failed to update lead', 400, res);
     }
};

export const getAllLeads = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new CustomersLeads(tenantId);
          const page = parseInt(req.query.page as string) || 1;
          const count = parseInt(req.query.count as string) || 10;
          const result = await repo.findAllPaginated(page, count);
          res.status(200).json({ success: true, data: result });
     } catch (error) {
          console.error('Get all leads error:', error);
          customError('Failed to fetch leads', 500, res);
     }
};

export const getLeadById = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new CustomersLeads(tenantId);
          const id = parseInt(req.params.id);
          const lead = await repo.findById(id);
          if (lead) {
               res.status(200).json({ success: true, data: lead });
          } else {
               customError('Lead not found', 404, res);
          }
     } catch (error) {
          console.error('Get lead by ID error:', error);
          customError('Failed to fetch lead', 500, res);
     }
};

export const deleteLead = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new CustomersLeads(tenantId);
          const id = parseInt(req.params.id);
          const deletedRows = await repo.delete(id);
          if (deletedRows > 0) {
               res.status(200).json({ success: true, message: 'Lead deleted successfully' });
          } else {
               customError('Lead not found', 404, res);
          }
     } catch (error) {
          console.error('Delete lead error:', error);
          customError('Failed to delete lead', 500, res);
     }
};