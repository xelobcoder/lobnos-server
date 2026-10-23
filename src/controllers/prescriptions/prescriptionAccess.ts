import { Request, Response, NextFunction } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { roleAllowed } from '../../middleware/roles';
import { PHARMACY_ACCESS_ROLES } from '../../models/pharmacy/constants/pharmacy.constants';
import { actorOf, roleOf, tenantOf } from '../pharmacy/pharmacyContext';

const prescribers = ['admin', 'doctor', 'clinician', 'medical_officer', 'consultant'];
export const prescriptionCreateAccess = (req: Request, res: Response, next: NextFunction) => {
     if (!roleAllowed(roleOf(req), prescribers)) return res.status(403).json({success:false,error:{message:'A prescribing role is required'}});
     next();
};
export async function prescriptionDetailAccess(req: Request, res: Response, next: NextFunction) {
     if (roleAllowed(roleOf(req), PHARMACY_ACCESS_ROLES)) return next();
     if (!roleAllowed(roleOf(req),prescribers)) return res.status(403).json({success:false,error:{message:'Prescription access is required'}});
     try {
          const db=await KnexConnection(tenantOf(req));
          const owned=await db('prescriptions').where({id:String(req.params.id),clinician_id:actorOf(req)}).first();
          if (!owned) return res.status(404).json({success:false,error:{message:'Prescription not found'}});
          next();
     } catch(error) { next(error); }
}

export async function validatePrescriptionContext(req: Request, res: Response, next: NextFunction) {
     try {
          const {patientId,consultationId}=req.body;
          if (!Number.isInteger(patientId) || patientId<=0 || (consultationId!=null && (!Number.isInteger(consultationId)||consultationId<=0))) return res.status(400).json({success:false,error:{message:'Valid patient and consultation identifiers are required'}});
          const db=await KnexConnection(tenantOf(req));
          if (!await db('new_patients').where({patientid:patientId}).first()) return res.status(404).json({success:false,error:{message:'Patient not found'}});
          if (consultationId) {
               const query=db('medicalrecords').where({id:consultationId,patientid:patientId});
               if(!roleAllowed(roleOf(req),['admin']))query.where('consulationby',actorOf(req));
               if(!await query.first())return res.status(403).json({success:false,error:{message:'Consultation is unavailable for this patient and prescriber'}});
          }
          next();
     } catch(error) { next(error); }
}
