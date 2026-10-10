import { Router, Request, Response } from 'express';
import logger from '../../hooks/logger';
import { PublicCatalogError, PublicFacilityCatalog } from '../../models/public/PublicFacilityCatalog';

const router = Router();
const service = new PublicFacilityCatalog();
const base = '/api/v1/public/facilities';

const handle = (operation: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
     res.setHeader('Cache-Control', 'no-store');
     res.setHeader('X-Content-Type-Options', 'nosniff');
     if (Object.keys(req.query).length) {
          res.status(400).json({ status: 'error', message: 'Public catalogs do not accept tenant or pricing parameters' });
          return;
     }
     try {
          res.json(await operation(req));
     } catch (error) {
          if (error instanceof PublicCatalogError) {
               res.status(error.statusCode).json({ status: 'error', message: error.message });
               return;
          }
          logger.error('Public facility directory/catalog unavailable');
          res.status(503).json({ status: 'error', message: 'The laboratory directory or catalog is temporarily unavailable' });
     }
};

router.get(base, handle(() => service.list()));
router.get(`${base}/:slug/catalog`, handle(req => {
     if (typeof req.params.slug !== 'string') throw new PublicCatalogError('Laboratory not found', 404);
     return service.catalog(req.params.slug);
}));
// Finish all requests in this public namespace before tenant middleware can resolve a default tenant.
router.use(base, (_req, res) => {
     res.status(404).json({ status: 'error', message: 'Public facility endpoint not found' });
});

export default router;
