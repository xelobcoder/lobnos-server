import { NextFunction, Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { normalizeRole } from '../../middleware/roles';

/** Legacy pharmacy inventory is historical once the independent pharmacy module is installed. */
export async function legacyPharmacyGuard(req: Request, res: Response, next: NextFunction) {
     const deny = () => res.status(403).json({ success: false, error: { code: 'PHARMACY_SEPARATED', message: 'Use the independent pharmacy inventory. Legacy pharmacy records are read-only.' } });
     if (normalizeRole((req as any).authUser?.role).startsWith('pharmacy')) return deny();
     if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
     try {
          if (JSON.stringify(req.body || {}).includes('"pharmacy"')) return deny();
          const db = await KnexConnection(Number((req as any).authUser.tenantId));
          // Inspect IDs in nested receiving/order/consumption payloads as well as URL IDs.
          const values = new Set<string>(req.path.split('/').map(decodeURIComponent));
          const collect = (v: any) => { if (typeof v === 'string' || typeof v === 'number') values.add(String(v)); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
          collect(req.body); const ids = [...values];
          if (await db('inv_inventory_items').where({ inventory_domain: 'pharmacy' }).whereIn('id', ids).first()) return deny();
          const orders = await db('inv_purchase_order_items').where(b => b.whereIn('order_id', ids).orWhereIn('id', ids)).select('inventory_item_id');
          if (orders.length && await db('inv_inventory_items').where({ inventory_domain: 'pharmacy' }).whereIn('id', orders.map((r: any) => r.inventory_item_id)).first()) return deny();
          next();
     } catch (error: any) { res.status(400).json({ success: false, error: { message: error.message } }); }
}
