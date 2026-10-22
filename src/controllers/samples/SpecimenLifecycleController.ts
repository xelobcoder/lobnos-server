import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { specimenLifecycleCapabilities, SpecimenLifecycleError, SpecimenLifecycleService } from '../../models/samples/SpecimenLifecycleService';

const scientific = ['admin', 'manager', 'scientist'];
const collection = [...scientific, 'phelobotomist', 'phlebotomist'];

export class SpecimenLifecycleController {
     private static async respond(req: Request, res: Response, roles: string[], operation: (service: SpecimenLifecycleService, actor: NonNullable<ReturnType<typeof getAuthUser>>) => Promise<any>, status = 200): Promise<void> {
          const actor = getAuthUser(req);
          if (!actor || Number(req.query.tenantId) !== Number(actor.tenantId)) {
               res.status(401).json({ success: false, message: 'A session for this facility is required' }); return;
          }
          if (!roleAllowed(actor.role, roles)) {
               res.status(403).json({ success: false, message: 'You are not authorized to perform this specimen operation' }); return;
          }
          try {
               const data = await operation(new SpecimenLifecycleService(actor.tenantId), actor);
               if (data?.sample) data.capabilities = specimenLifecycleCapabilities(actor.role, data.sample);
               res.status(status).json({ success: true, data });
          } catch (error: any) {
               const code = error instanceof SpecimenLifecycleError ? error.statusCode : error.code === 'ER_DUP_ENTRY' ? 409 : 500;
               res.status(code).json({ success: false, message: error instanceof SpecimenLifecycleError ? error.message : code === 409 ? 'That storage position or request is already in use; reload and try again' : 'Unable to complete specimen operation' });
          }
     }

     static worklist = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, collection, service => service.worklist(req.query));
     static positions = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, collection, service => service.positions());
     static createPosition = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, ['admin', 'manager'], (service, actor) => service.createPosition(req.body, actor.employeeid), 201);
     static detail = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, collection, (service, actor) => service.detail(Number(req.params.id), actor.role));
     static aliquot = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, scientific, (service, actor) => service.aliquot(Number(req.params.id), req.body, actor.employeeid), 201);
     static store = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, collection, (service, actor) => service.store(Number(req.params.id), req.body, actor.employeeid));
     static retrieve = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, collection, (service, actor) => service.retrieve(Number(req.params.id), req.body, actor.employeeid));
     static retention = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, scientific, (service, actor) => service.setRetention(Number(req.params.id), req.body, actor.employeeid, roleAllowed(actor.role, ['admin', 'manager'])));
     static dispose = (req: Request, res: Response) => SpecimenLifecycleController.respond(req, res, scientific, (service, actor) => service.dispose(Number(req.params.id), req.body, actor.employeeid, roleAllowed(actor.role, ['admin', 'manager'])));
}
