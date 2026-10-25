import { Request, Response } from 'express';
import { getAuthUser } from '../../../middleware/authority';
import { PackageConfiguration } from '../../../models/billing/packages/PackageConfiguration';
export async function packageConfigurationHandler(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, message: 'Authentication required.' });
    const id = req.params.id === undefined ? undefined : Number(req.params.id);
    if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) return res.status(400).json({ status: false, message: 'Invalid package ID.' });
    try {
        const service = new PackageConfiguration(actor.tenantId);
        const data = req.method === 'GET' ? await service.get(id!) : await service.save(actor.employeeid, req.body, id);
        return res.json({ status: true, data });
    } catch (error: any) { return res.status(400).json({ status: false, message: error.issues?.[0]?.message || error.message || 'Unable to save package configuration.' }); }
}
