import type { Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { normalizeRole, roleAllowed } from '../../middleware/roles';

const registrationRoles = [
     'admin', 'manager', 'crm', 'receptionist', 'frontdesk', 'frontdeskofficer',
     'customer representative', 'customer service representative',
];

export async function reviewPatientDuplicates(req: Request, res: Response) {
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ message: 'Authentication required' });

     try {
          const db = await KnexConnection(actor.tenantId);
          const scientist = ['scientist', 'labscientist'].includes(normalizeRole(actor.role));
          const settings = scientist
               ? await db('applicationsettings').where({ keyid: 1 }).first('allowScientistToRegisterClient')
               : undefined;
          if (!roleAllowed(actor.role, registrationRoles) && Number(settings?.allowScientistToRegisterClient) !== 1) {
               return res.status(403).json({ message: 'Patient registration access is required' });
          }

          if (req.method === 'POST') {
               const id = Number(req.params.id);
               if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid candidate ID' });
               const updated = await db('patient_duplicate_candidates').where({ id }).whereNull('dismissed_at')
                    .update({ dismissed_by: actor.employeeid, dismissed_at: db.fn.now() });
               if (!updated) return res.status(409).json({ message: 'This match is no longer pending. Refresh the review list.' });
               return res.json({ status: 'success' });
          }

          const patientId = req.query.patientid === undefined ? null : Number(req.query.patientid);
          const before = req.query.before === undefined ? null : Number(req.query.before);
          if ([patientId, before].some(id => id !== null && (!Number.isSafeInteger(id) || id <= 0))) {
               return res.status(400).json({ message: 'Invalid patient or review cursor' });
          }

          const query = db('patient_duplicate_candidates as flag')
               .join('new_patients as registered', 'registered.patientid', 'flag.registered_patient_id')
               .join('new_patients as candidate', 'candidate.patientid', 'flag.candidate_patient_id')
               .whereNull('flag.dismissed_at')
               .select('flag.id', 'flag.evidence', 'flag.created_at')
               .orderBy('flag.id', 'desc').limit(26);
          for (const alias of ['registered', 'candidate']) {
               query.select(...['patientid', 'fullpatientid', 'firstname', 'middlename', 'lastname']
                    .map(column => db.raw('?? as ??', [`${alias}.${column}`, `${alias}_${column}`])));
               query.select(db.raw("DATE_FORMAT(??, '%Y-%m-%d') as ??", [`${alias}.dob`, `${alias}_dob`]));
          }
          if (patientId !== null) query.where('flag.registered_patient_id', patientId);
          if (before !== null) query.where('flag.id', '<', before);
          const results = await query;
          return res.json({ status: 'success', data: results.slice(0, 25), next: results.length > 25 ? results[24].id : null });
     } catch {
          return res.status(500).json({ message: 'Unable to load or update possible duplicates' });
     }
}
