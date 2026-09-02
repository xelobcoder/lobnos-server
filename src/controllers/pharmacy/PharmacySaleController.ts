import { Request, Response } from 'express';
import { PharmacySaleRepository } from '../../models/pharmacy/repositories/PharmacySaleRepository';
import { PharmacySaleService } from '../../models/pharmacy/services/PharmacySaleService';
import { actorOf, tenantOf } from './pharmacyContext';

const saleService = (request: Request) => new PharmacySaleService(new PharmacySaleRepository(tenantOf(request)));

export class PharmacySaleController {
     static async getSalesHistory(request: Request, response: Response): Promise<void> {
          try {
               const history = await saleService(request).getSalesHistory(
                    Number(request.query.page || 1),
                    Number(request.query.count || 20),
                    String(request.query.search || '')
               );
               response.json({ success: true, data: history });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'SALES_HISTORY_UNAVAILABLE', message: error.message } });
          }
     }

     static async getSaleDetail(request: Request, response: Response): Promise<void> {
          try {
               response.json({ success: true, data: await saleService(request).getSaleDetail(String(request.params.saleId)) });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : 500;
               response.status(status).json({ success: false, error: { code: 'SALE_UNAVAILABLE', message: error.message } });
          }
     }

     static async completeSale(request: Request, response: Response): Promise<void> {
          try {
               const receipt = await saleService(request).completeSale(request.body, actorOf(request));
               response.status(201).json({ success: true, data: receipt });
          } catch (error: any) {
               const status = /unavailable|insufficient|requires a prescription|positive|Duplicate/.test(error.message) ? 409 : 400;
               response.status(status).json({ success: false, error: { code: 'SALE_REJECTED', message: error.message } });
          }
     }

     static async reverseSale(request: Request, response: Response): Promise<void> {
          try {
               const reversal = await saleService(request).reverseSale(String(request.params.saleId), request.body, actorOf(request));
               response.json({ success: true, data: reversal });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : /already/i.test(error.message) ? 409 : 400;
               response.status(status).json({ success: false, error: { code: 'REVERSAL_REJECTED', message: error.message } });
          }
     }
}
