import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import ApplicationSettings from '../../models/application/appsettings/appset';
import { isWorkspaceLayout } from '../../models/application/appsettings/workspaceLayout';

export async function updateWorkspaceLayout(req: Request, res: Response) {
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required' });
     if (!Number.isSafeInteger(actor.tenantId) || actor.tenantId <= 0) {
          return res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
     }
     const workspaceLayout = req.body?.workspaceLayout;
     if (!isWorkspaceLayout(workspaceLayout)) {
          return res.status(400).json({ status: 'error', statusCode: 400, message: 'workspaceLayout must be classic, zoho, claude, ribbon, or slack' });
     }
     try {
          const updated = await new ApplicationSettings().updateWorkspaceLayout(actor.tenantId, workspaceLayout);
          if (!updated) {
               return res.status(409).json({ status: 'error', statusCode: 409, message: 'Application settings must be initialized first' });
          }
          return res.status(200).json({ status: 'success', statusCode: 200, result: { workspaceLayout } });
     } catch {
          return res.status(500).json({ status: 'error', statusCode: 500, message: 'Unable to update workspace layout' });
     }
}
