import { Request, Response, Router } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { requireTestPanelManagement } from '../../middleware/testPanelAuthority';

function tenantOf(request: Request): number {
     const tenantId = Number(getAuthUser(request)?.tenantId);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw Object.assign(new Error('Authenticated facility required'), { statusCode: 401 });
     return tenantId;
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
     if (value === undefined || value === null || value === '') return fallback;
     const parsed = Number(value);
     if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw Object.assign(new Error(`Expected a whole number between ${min} and ${max}`), { statusCode: 400 });
     return parsed;
}

function optionalPositive(value: unknown, label: string): number | null {
     if (value === undefined || value === null || value === '') return null;
     const parsed = Number(value);
     if (!Number.isFinite(parsed) || parsed < 0) throw Object.assign(new Error(`${label} must be zero or a positive number`), { statusCode: 400 });
     return parsed;
}

function cleanRule(body: any) {
     const testid = integer(body?.testid, 0, 0, 2_147_483_647);
     const fieldid = integer(body?.fieldid, 0, 0, 2_147_483_647);
     const window_hours = integer(body?.window_hours, 720, 1, 8760);
     const max_absolute = optionalPositive(body?.max_absolute, 'Absolute change limit');
     const max_percent = optionalPositive(body?.max_percent, 'Percentage change limit');
     if (max_absolute === null && max_percent === null) throw Object.assign(new Error('Set an absolute limit, a percentage limit, or both'), { statusCode: 400 });
     const action = body?.action === 'block' ? 'block' : body?.action === 'warn' ? 'warn' : null;
     if (!action) throw Object.assign(new Error('Action must be warn or block'), { statusCode: 400 });
     const notes = body?.notes === undefined || body?.notes === null ? null : String(body.notes).trim().slice(0, 255) || null;
     return { testid, fieldid, window_hours, max_absolute, max_percent, action, notes };
}

export const resultSafetyRouter = Router();

resultSafetyRouter.get('/api/v1/operations/result-safety/delta-rules', requireTestPanelManagement, async (request: Request, response: Response) => {
     try {
          const db = await KnexConnection(tenantOf(request));
          const rules = await db('pls_delta_rules').orderBy([{ column: 'testid', order: 'desc' }, { column: 'fieldid', order: 'desc' }, { column: 'id', order: 'desc' }]);
          response.json({ status: 'success', statusCode: 200, data: rules });
     } catch (error: any) {
          response.status(error.statusCode || 500).json({ status: 'error', message: error.message || 'Unable to load delta rules' });
     }
});

resultSafetyRouter.post('/api/v1/operations/result-safety/delta-rules', requireTestPanelManagement, async (request: Request, response: Response) => {
     try {
          const tenantId = tenantOf(request);
          const rule = cleanRule(request.body);
          const db = await KnexConnection(tenantId);
          const [id] = await db('pls_delta_rules').insert({
               ...rule,
               active: request.body?.active === false ? false : true,
               created_by: getAuthUser(request)?.employeeid ?? null,
               created_at: new Date(),
               updated_at: new Date(),
          });
          const created = await db('pls_delta_rules').where({ id }).first();
          response.status(201).json({ status: 'success', statusCode: 201, data: created });
     } catch (error: any) {
          response.status(error.statusCode || 500).json({ status: 'error', message: error.message || 'Unable to save the delta rule' });
     }
});

resultSafetyRouter.patch('/api/v1/operations/result-safety/delta-rules/:id', requireTestPanelManagement, async (request: Request, response: Response) => {
     try {
          const tenantId = tenantOf(request);
          const id = integer(request.params.id, 0, 1, 2_147_483_647);
          const db = await KnexConnection(tenantId);
          const existing = await db('pls_delta_rules').where({ id }).first();
          if (!existing) return response.status(404).json({ status: 'error', message: 'Delta rule not found' });
          const merged = cleanRule({ ...existing, ...request.body });
          const active = request.body?.active === undefined ? existing.active : Boolean(request.body.active);
          await db('pls_delta_rules').where({ id }).update({ ...merged, active, updated_at: new Date() });
          response.json({ status: 'success', statusCode: 200, data: await db('pls_delta_rules').where({ id }).first() });
     } catch (error: any) {
          response.status(error.statusCode || 500).json({ status: 'error', message: error.message || 'Unable to update the delta rule' });
     }
});

resultSafetyRouter.get('/api/v1/operations/result-safety/events', requireTestPanelManagement, async (request: Request, response: Response) => {
     try {
          const tenantId = tenantOf(request);
          const db = await KnexConnection(tenantId);
          const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 50));
          let query = db('pls_result_safety_events').orderBy('id', 'desc').limit(limit);
          if (request.query.ascensionid) query = query.where({ ascensionid: Number(request.query.ascensionid) });
          const events = await query;
          response.json({ status: 'success', statusCode: 200, data: events });
     } catch (error: any) {
          response.status(error.statusCode || 500).json({ status: 'error', message: error.message || 'Unable to load result safety events' });
     }
});

export default resultSafetyRouter;
