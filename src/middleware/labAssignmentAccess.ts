import type { RequestHandler } from 'express';
import { getAuthUser } from './authority';
import { normalizeRole } from './roles';
import KnexConnection from '../database/KnexConnections';
import { assertLabTestAccess, labAccessSettings } from '../models/operations/LabAccessPolicy';
import ResultSettings from '../models/application/appsettings/result-settings/resultSettings';

/** Enforce direct URLs and legacy bulk APIs as well as the workbench. Never rewrite request queries. */
export const labAssignmentAccess: RequestHandler = async (req, res, next) => {
     try {
          const actor = getAuthUser(req); if (!actor || normalizeRole(actor.role) !== 'scientist') return next();
          const path = req.path;
          if (!/^\/api\/v1\/(operations|outsourced|result|test\/approval|testpanel\/list\/customtestrule\/previous)/.test(path)) return next();
          if (/^\/api\/v1\/operations\/(control|laboratory\/workbench)(\/|$)/.test(path)) return next();
          const db = await KnexConnection(actor.tenantId), settings = await labAccessSettings(db);
          const editing = req.method !== 'GET' && !path.includes('/test/approval/');
          if (editing ? settings?.editing !== 'assigned' : settings?.visibility !== 'restricted') return next();
          const validator = !editing && await ResultSettings.canStaffApproveResult(actor.tenantId, actor.employeeid);
          const value = req.body?.ascensionid ?? req.body?.ascensionId ?? req.query.ascensionid ?? req.query.ascensionId;
          let ids = value == null ? [] : String(value).split(',').map(Number);
          if (!ids.length) {
               const decode = (v: any, prefix: number) => { if (v == null || v === '' || v === 'undefined') return null; const s = String(v); const n = /^\d+$/.test(s) ? Number(s) : Number(s.slice(prefix)); return Number.isSafeInteger(n) && n > 0 ? n : null; };
               const billingid = decode(req.query.billingid ?? req.body?.billingid ?? req.query.csvid ?? req.body?.csvid, 70);
               const patientid = decode(req.query.patientid ?? req.query.ptid ?? req.body?.ptid, 50);
               if (billingid || patientid) {
                    let q = db('test_ascension as test').join('billing as bill', 'bill.billingid', 'test.billingid').select('test.id');
                    if (billingid) q.where('bill.billingid', billingid); if (patientid) q.where('bill.patientid', patientid);
                    if (actor.branch != null) q.where('bill.branchid', actor.branch);
                    ids = (await q).map(row => Number(row.id));
               }
          }
          if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return res.status(400).json({ status: 'error', message: 'Invalid ordered test ID' });
          if (!ids.length && !(validator && path === '/api/v1/operations/ascension/staging' && req.query.operationsStaging === 'VALIDATION')) return res.status(403).json({ status: 'error', message: 'Restricted laboratory access: use your assigned workbench or select an assigned test.' });
          for (const id of ids) await assertLabTestAccess(db, actor, id, editing, validator);
          next();
     } catch (error: any) { res.status(Number(error.statusCode) || 500).json({ status: 'error', message: Number(error.statusCode) ? error.message : 'Unable to verify laboratory access' }); }
};
