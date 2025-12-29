import { Request, Response } from 'express';
import { IncidentModel } from '../../models/settings/compliance/Incident';
import {
     CreateIncidentRequest,
     UpdateIncidentRequest,
     IncidentFilters,
     AuditTrailFilters
} from '../../models/settings/compliance/types';
import { IncidentValidation } from '../../models/settings/compliance/validation';
import User from '../../LobnosAuth/user';
import RolesRepository from '../../models/settings/users/RolesRepository';

export class IncidentController {
     private getTenantId(req: Request): number {
          return parseInt(req.query.tenantId as string);
     }

     private getUserContext(req: Request): { employeeId: number } {
          return {
               employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : 0
          }
     }

     async getIncidents(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const employeeId = parseInt(req.query.employeeId as string);
               const requesterEmployeeId = this.getUserContext(req).employeeId;
               const filters: IncidentFilters = {
                    page: parseInt(req.query.page as string) || 1,
                    count: parseInt(req.query.count as string) || 10,
                    sortby: (req.query.sortby as 'ASC' | 'DESC') || 'DESC',
                    type: req.query.type as any,
                    severity: req.query.severity as any,
                    status: req.query.status as any,
                    startDate: req.query.start_date as string,
                    endDate: req.query.end_date as string
               };

               // Check user role - only filter by employeeId for non-admin users
               if (requesterEmployeeId && requesterEmployeeId !== 0) {
                    const user = new User(null, null, null, null, null);
                    const role = await new RolesRepository(tenantId).getEmployeeRole(requesterEmployeeId);
                    if (['admin','super-admin'].includes(role) == false) {
                         filters.reportedBy = requesterEmployeeId;
                    }
               } 

               console.log('Filters applied:',requesterEmployeeId, filters);

               const validation = IncidentValidation.validateFilters(filters);
               if (!validation.isValid) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: validation.errors.join(', ')
                    });
                    return;
               }

               const incidentModel = new IncidentModel(tenantId);
               const result = await incidentModel.findMany(filters);

               res.json(result);
          } catch (error) {
               console.error('Error fetching incidents:', error);
               res.status(500).json({
                    error: 'Internal server error',
                    message: 'Failed to retrieve incidents'
               });
          }
     }

     async createIncident(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const userContext = this.getUserContext(req);

               const requestData: CreateIncidentRequest = req.body;

               const validation = IncidentValidation.validateCreateRequest(requestData);
               if (!validation.isValid) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: validation.errors.join(', ')
                    });
                    return;
               }

               const incidentModel = new IncidentModel(tenantId);
               const incident = await incidentModel.create(requestData, userContext.employeeId, userContext);

               res.status(201).json({
                    success: true,
                    data: incident
               });
          } catch (error) {
               console.error('Error creating incident:', error);
               res.status(500).json({
                    error: 'Internal server error',
                    message: 'Failed to create incident'
               });
          }
     }

     async updateIncident(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const userContext = this.getUserContext(req);
               const { id } = req.params;
               const updateData: UpdateIncidentRequest = req.body;

               if (!id) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: 'Incident ID is required'
                    });
                    return;
               }

               const validation = IncidentValidation.validateUpdateRequest(updateData);
               if (!validation.isValid) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: validation.errors.join(', ')
                    });
                    return;
               }

               const incidentModel = new IncidentModel(tenantId);
               const updatedIncident = await incidentModel.update(id, updateData, userContext);

               if (!updatedIncident) {
                    res.status(404).json({
                         error: 'Not found',
                         message: 'Incident not found'
                    });
                    return;
               }

               res.json({
                    success: true,
                    data: updatedIncident
               });
          } catch (error: any) {
               console.error('Error updating incident:', error);

               if (error.message.includes('Invalid status transition')) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: error.message
                    });
                    return;
               }

               if (error.message.includes('Incident not found')) {
                    res.status(404).json({
                         error: 'Not found',
                         message: error.message
                    });
                    return;
               }

               res.status(500).json({
                    error: 'Internal server error',
                    message: 'Failed to update incident'
               });
          }
     }

     async getIncident(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               if (!id) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: 'Incident ID is required'
                    });
                    return;
               }

               const incidentModel = new IncidentModel(tenantId);
               const incident = await incidentModel.findById(id);

               if (!incident) {
                    res.status(404).json({
                         error: 'Not found',
                         message: 'Incident not found'
                    });
                    return;
               }

               res.json({
                    success: true,
                    data: incident
               });
          } catch (error) {
               console.error('Error fetching incident:', error);
               res.status(500).json({
                    error: 'Internal server error',
                    message: 'Failed to retrieve incident'
               });
          }
     }

     async deleteIncident(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const userContext = this.getUserContext(req);
               const { id } = req.params;

               if (!id) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: 'Incident ID is required'
                    });
                    return;
               }

               const incidentModel = new IncidentModel(tenantId);
               const deleted = await incidentModel.delete(id, userContext);

               if (!deleted) {
                    res.status(404).json({
                         error: 'Not found',
                         message: 'Incident not found'
                    });
                    return;
               }

               res.json({
                    success: true,
                    message: 'Incident deleted successfully'
               });
          } catch (error) {
               console.error('Error deleting incident:', error);
               res.status(500).json({
                    error: 'Internal server error',
                    message: 'Failed to delete incident'
               });
          }
     }

     async getIncidentAuditTrail(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               if (!id) {
                    res.status(400).json({
                         error: 'Validation error',
                         message: 'Incident ID is required'
                    });
                    return;
               }

               const filters: AuditTrailFilters = {
                    page: parseInt(req.query.page as string) || 1,
                    count: parseInt(req.query.count as string) || 10,
                    sortby: (req.query.sortby as 'ASC' | 'DESC') || 'DESC',
                    action: req.query.action as string,
                    employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined,
                    startDate: req.query.start_date as string,
                    endDate: req.query.end_date as string
               };

               const incidentModel = new IncidentModel(tenantId);
               const result = await incidentModel.getAuditTrail(id, filters);

               res.json(result);
          } catch (error) {
               console.error('Error fetching incident audit trail:', error);
               res.status(500).json({
                    error: 'Internal server error',
                    message: 'Failed to retrieve incident audit trail'
               });
          }
     }

     async getAllAuditTrails(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const filters: AuditTrailFilters = {
                    page: parseInt(req.query.page as string) || 1,
                    count: parseInt(req.query.count as string) || 10,
                    sortby: (req.query.sortby as 'ASC' | 'DESC') || 'DESC',
                    action: req.query.action as string,
                    employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined,
                    startDate: req.query.start_date as string,
                    endDate: req.query.end_date as string
               };

               const incidentModel = new IncidentModel(tenantId);
               const result = await incidentModel.getAllAuditTrails(filters);

               res.json(result);
          } catch (error) {
               console.error('Error fetching audit trails:', error);
               res.status(500).json({
                    error: 'Internal server error',
                    message: 'Failed to retrieve audit trails'
               });
          }
     }
}