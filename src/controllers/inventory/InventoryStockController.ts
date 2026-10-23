import { expiredInventoryBatchQuery } from '../../models/inventory/InventoryBatchQuery';
import { Request, Response } from 'express';
import { InventoryTransactionModel } from '../../models/inventory/InventoryTransaction';
import {
     ApiResponse,
     AvailableStockDetails
} from '../../models/inventory/types';

export class InventoryStockController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     private getModel(req: Request): InventoryTransactionModel {
          const tenantId = this.getTenantId(req);
          return new InventoryTransactionModel(tenantId);
     }

     async getAvailableStockDetails(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const { item_id } = req.params;

               if (!item_id) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const stockDetails = await model.getAvailableStockDetails(item_id as string);

               const response: ApiResponse<AvailableStockDetails> = {
                    success: true,
                    data: stockDetails
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting available stock details:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get available stock details'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getExpiredBatches(req: Request, res: Response): Promise<void> {
          return this.respondExpiredBatches(req, res);
     }

     async getExpiredBatchesForItem(req: Request, res: Response): Promise<void> {
          const itemId = req.params.item_id as string;
          if (!itemId) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Item ID is required' } }); return; }
          return this.respondExpiredBatches(req, res, itemId);
     }

     private async respondExpiredBatches(req: Request, res: Response, itemId?: string): Promise<void> {
          try {
               const page = Number(req.query.page ?? 1);
               const count = Number(req.query.count ?? 10);
               const days = Number(req.query.days_to_expiry ?? 30);
               if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(count) || count < 1 || count > 200 || !Number.isSafeInteger(days) || days < 0 || days > 36500) {
                    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid pagination or expiry threshold' } }); return;
               }
               const model = this.getModel(req);
               const connection = await (model as any).connection;
               const sortby = String(req.query.sortby).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
               let query = expiredInventoryBatchQuery(connection);
               const selectedItem = itemId || req.query.item_id;
               if (selectedItem) query = query.where('movement.item_id', selectedItem as string);
               if (req.query.batch_number) query = query.where('movement.batch_number', req.query.batch_number as string);
               const summary = await connection.from(query.clone().as('expired')).select(
                    connection.raw('COUNT(*) as total'), connection.raw('COUNT(DISTINCT item_id) as unique_items'),
                    connection.raw('COALESCE(SUM(available_quantity), 0) as quantity'),
                    connection.raw('COALESCE(SUM(available_quantity * unit_price), 0) as value')
               ).first();
               const total = Number(summary.total);
               const rows = await query.orderBy('expiry_date', sortby).orderBy('movement.item_id').orderBy('movement.batch_number').limit(count).offset((page - 1) * count);
               const threshold = new Date(); threshold.setDate(threshold.getDate() + days);
               res.json({
                    success: true,
                    data: {
                         expired_batches: rows.map((batch: any) => ({
                              ...batch, unit_price: Number(batch.unit_price || 0), total_received: Number(batch.total_received),
                              total_consumed: Number(batch.total_consumed), available_quantity: Number(batch.available_quantity),
                              total_value: Number(batch.available_quantity) * Number(batch.unit_price || 0),
                              days_to_expiry: Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / 86400000)
                         })),
                         total, page, count, totalPages: Math.ceil(total / count), sortby,
                         summary: { total_expired_batches: total, total_expired_quantity: Number(summary.quantity), total_expired_value: Number(summary.value),
                              unique_items_affected: Number(summary.unique_items), expiry_threshold_days: days, expiry_threshold_date: threshold.toISOString().slice(0, 10) }
                    },
                    pagination: { total, page, count, totalPages: Math.ceil(total / count), sortby }
               });
          } catch (error: any) {
               console.error('Error getting expired batches:', error);
               res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get expired batches' } });
          }
     }

     async getItemTransactions(req: Request, res: Response): Promise<void> {
          try {
               const model = this.getModel(req);
               const { item_id } = req.params;
               const { days = 30, startDate, endDate, type, page = 1, count = 10 } = req.query;

               if (!item_id) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate pagination parameters
               const pageNum = parseInt(page as string);
               const countNum = parseInt(count as string);

               if (pageNum < 1) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Page must be greater than 0'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               if (countNum < 1 || countNum > 100) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'VALIDATION_ERROR',
                              message: 'Count must be between 1 and 100'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const result = await model.getItemStockHistory(item_id as string, {
                    days: parseInt(days as string) || 30,
                    startDate: startDate as string,
                    endDate: endDate as string,
                    type: type as string,
                    page: pageNum,
                    count: countNum
               });

               const response: ApiResponse<any> = {
                    success: true,
                    data: {
                         transactions: result.transactions,
                         pagination: {
                              page: pageNum,
                              count: countNum,
                              total: result.total,
                              totalPages: Math.ceil(result.total / countNum)
                         }
                    }
               };
               res.json(response);
          } catch (error: any) {
               console.error('Error getting item transactions:', error);
               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to get item transactions'
                    }
               };
               res.status(500).json(response);
          }
     }
}