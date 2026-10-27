import type {Request, Response, NextFunction} from 'express';
import multer from 'multer';
import KnexConnection from '../../database/KnexConnections';
import {getAuthUser} from '../../middleware/authority';
import {OrganizationLogoStore} from '../../models/organization/OrganizationLogoStore';

const store = new OrganizationLogoStore();
const receive = multer({storage: multer.memoryStorage(), limits: {fileSize: 5 * 1024 * 1024, files: 1}}).single('organizations');
async function identity(req: Request, res: Response) {
    const user = getAuthUser(req), id = Number(req.query.id);
    if (!user) { res.status(401).json({status: false, message: 'Authentication required'}); return null; }
    if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({status: false, message: 'Select a valid organization'}); return null; }
    const db = await KnexConnection(user.tenantId);
    if (!await db('organization').where({id}).first()) { res.status(404).json({status: false, message: 'Organization not found'}); return null; }
    return {tenant: user.tenantId, id};
}
export async function uploadOrganizationLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const scope = await identity(req, res); if (!scope) return;
        receive(req, res, async error => {
            if (error) { res.status(400).json({status: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Choose an image up to 5 MB.' : error.message}); return; }
            try {
                if (!req.file) { res.status(400).json({status: false, message: 'Choose an image to upload.'}); return; }
                await store.save(scope.tenant, scope.id, req.file.buffer);
                res.setHeader('Cache-Control', 'private, no-store');
                res.json({status: true, message: 'Organization logo saved'});
            } catch (error: any) { res.status(400).json({status: false, message: error.message || 'Unable to save logo'}); }
        });
    } catch (error) { next(error); }
}
export async function getOrganizationLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const scope = await identity(req, res); if (!scope) return;
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const image = await store.read(scope.tenant, scope.id);
        if (!image) { res.status(404).json({status: false, message: 'No organization logo uploaded'}); return; }
        res.type(image.mediaType).send(image.bytes);
    } catch (error) { next(error); }
}
