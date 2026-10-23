import { Router, Request, Response } from "express";
import { InventoryTransactionModel, ApiResponse } from "../../../models/inventory";
import { handleOverLoad } from "../../../hooks/helper";
import { inventoryTransactionSchema } from "../../../models/inventory/InventoryTransaction";


const router = Router();


const create = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Tenant ID is required' }
               });
          }

          const validation = inventoryTransactionSchema.safeParse(req.body);
          if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.message } });
          const model = new InventoryTransactionModel(tenantId);
          const transaction = await model.create(req.body);

          const response: ApiResponse<any> = {
               success: true,
               data: transaction
          };

          res.status(201).json(response);
     } catch (error: any) {
          console.error('Transaction creation error:', error);
          res.status(500).json({
               success: false,
               error: { code: 'INTERNAL_ERROR', message: error.message || 'Transaction creation failed' }
          });
     }
}

router.post('/create', handleOverLoad(create));

export default router;
