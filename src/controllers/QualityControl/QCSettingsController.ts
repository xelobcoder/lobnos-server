import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { QCSettingsRepository, validateQcDefaults } from '../../repositories/QualityControl/QCSettingsRepository';
export async function getQcSettings(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, error: 'Authentication required' });
    try { res.setHeader('Cache-Control', 'private, no-store'); return res.json({ status: true, settings: await new QCSettingsRepository(actor.tenantId).get() }); }
    catch { return res.status(500).json({ status: false, error: 'QC settings could not be loaded' }); }
}
export async function saveQcSettings(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, error: 'Authentication required' });
    if (!roleAllowed(actor.role, ['admin', 'manager'])) return res.status(403).json({ status: false, error: 'Supervisor access required to change QC defaults' });
    try { validateQcDefaults(req.body); } catch (error: any) { return res.status(400).json({ status: false, error: error.message }); }
    try { return res.json({ status: true, settings: await new QCSettingsRepository(actor.tenantId).save(req.body, actor.employeeid) }); }
    catch (error: any) { return res.status(error.message.includes('changed') ? 409 : 500).json({ status: false, error: error.message.includes('changed') ? error.message : 'QC settings could not be saved' }); }
}
