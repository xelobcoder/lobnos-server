import { Request, Response } from 'express';
import AccessWindowsRepo from '../../models/security/RequestAcessResult/accessWindowsRepo';

export class AccessWindowsController {
     static async createAccessWindow(req: Request, res: Response) {
          try {
               const { employeeid, category, edit_window, access_window, applicable_role, require_approval } = req.body;

               // Validate category
               if (!['global', 'individual'].includes(category)) {
                    return res.status(400).json({
                         status: false,
                         error: 'Category must be either "global" or "individual"'
                    });
               }

               // Validate that global records use employeeid = 0
               if (category === 'global' && employeeid !== 0) {
                    return res.status(400).json({
                         status: false,
                         error: 'Global access windows must use employeeid: 0'
                    });
               }

               // Validate that individual records use actual employee IDs
               if (category === 'individual' && employeeid === 0) {
                    return res.status(400).json({
                         status: false,
                         error: 'Individual access windows must use actual employee IDs (not 0)'
                    });
               }

               const windowData = {
                    employeeid,
                    category,
                    edit_window,
                    access_window,
                    applicable_role,
                    require_approval
               };

               const id = await AccessWindowsRepo.create(windowData);
               const message = category === 'global'
                    ? 'Global access window created/updated successfully'
                    : 'Individual access window created/updated successfully';

               res.status(201).json({
                    status: true,
                    message,
                    accessWindowId: id,
                    category
               });
          } catch (error: any) {
               // Handle unique constraint violation
               if (error.code === 'ER_DUP_ENTRY') {
                    res.status(409).json({
                         status: false,
                         error: 'An access window already exists for this employee/category combination'
                    });
               } else {
                    res.status(500).json({
                         status: false,
                         error: error.message
                    });
               }
          }
     } static async getAccessWindow(req: Request, res: Response) {
          try {
               const id  = req.params.id;
               const window = await AccessWindowsRepo.findById(parseInt(id.toString()));

               if (!window) {
                    return res.status(404).json({
                         status: false,
                         error: 'Access window not found'
                    });
               }

               res.json({
                    status: true,
                    data: window
               });
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getAccessWindowByEmployee(req: Request, res: Response) {
          try {
               const employeeid = req.params.employeeid;
               const window = await AccessWindowsRepo.findByEmployeeId(parseInt(employeeid.toString()));

               if (!window) {
                    return res.status(404).json({
                         status: false,
                         error: 'Access window not found for this employee'
                    });
               }

               res.json({
                    status: true,
                    data: window
               });
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getAllAccessWindows(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string) || 1;
               const { page, count } = req.query;
               const windows = await AccessWindowsRepo.findAll({
                    page: page ? parseInt(page as string) : undefined,
                    count: count ? parseInt(count as string) : undefined,
                    tenantId
               });
               res.json({
                    status: true,
                    data: windows
               });
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async updateAccessWindow(req: Request, res: Response) {
          try {
               const  id  = req.params.id;
               const updates = req.body;

               const success = await AccessWindowsRepo.update(parseInt(id.toString()), updates);

               if (success) {
                    res.json({
                         status: true,
                         message: 'Access window updated successfully'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Access window not found'
                    });
               }
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async deleteAccessWindow(req: Request, res: Response) {
          try {
               const id = req.params.id;
               const success = await AccessWindowsRepo.delete(parseInt(id.toString()));

               if (success) {
                    res.json({
                         status: true,
                         message: 'Access window deleted successfully'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Access window not found'
                    });
               }
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async deleteAccessWindowByEmployee(req: Request, res: Response) {
          try {
               const employeeid = req.params.employeeid;
               const success = await AccessWindowsRepo.deleteByEmployeeId(parseInt(employeeid.toString()));

               if (success) {
                    res.json({
                         status: true,
                         message: 'Individual access window deleted successfully - employee will use global settings'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Individual access window not found for this employee'
                    });
               }
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getEffectiveSettings(req: Request, res: Response) {
          try {
               const employeeid = req.params.employeeid
               const settings = await AccessWindowsRepo.getEffectiveSettings(parseInt(employeeid.toString()));

               if (!settings) {
                    return res.status(404).json({
                         status: false,
                         error: 'No access settings found'
                    });
               }

               res.json({
                    status: true,
                    data: settings
               });
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }
}