import { Request, Response } from 'express';
import { PHARMACY_REVERSED_STATUSES } from '../../models/pharmacy/constants/pharmacy.constants';
import { PharmacySaleReversalType } from '../../models/pharmacy/interfaces/IPharmacySaleService';
import { PharmacySaleRepository } from '../../models/pharmacy/repositories/PharmacySaleRepository';
import { PharmacySaleService } from '../../models/pharmacy/services/PharmacySaleService';
import { actorOf, tenantOf, branchOf } from './pharmacyContext';
import { roleAllowed } from '../../middleware/roles';
import { PHARMACY_REVERSAL_ROLES } from '../../models/pharmacy/constants/pharmacy.constants';

const saleService = (request: Request) => new PharmacySaleService(new PharmacySaleRepository(tenantOf(request), branchOf(request),roleAllowed((request as any).authUser.role,PHARMACY_REVERSAL_ROLES)), branchOf(request));

const listParams = (request: Request) => ({
     page: Number(request.query.page || 1),
     count: Number(request.query.count || 20),
     search: String(request.query.search || '')
});

export class PharmacySaleController {
     static async holdSale(request: Request, response: Response): Promise<void> {
          try {
               const heldSale = await saleService(request).holdSale(request.body, actorOf(request));
               response.status(201).json({ success: true, data: heldSale });
          } catch (error: any) {
               const uncertain=typeof error.code==='string';
               response.status(uncertain?503:400).json({ success: false, error: { code: uncertain?'PHARMACY_OPERATION_UNCONFIRMED':'PHARMACY_OPERATION_REJECTED', message: uncertain?'Suspension could not be confirmed. Retry the original request.':error.message } });
          }
     }

     static async getHeldSales(request: Request, response: Response): Promise<void> {
          try {
               const params = listParams(request);
               response.json({ success: true, data: await saleService(request).getHeldSales(params.page, params.count, params.search) });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'HELD_SALES_UNAVAILABLE', message: error.message } });
          }
     }

     static async getHeldSale(request: Request, response: Response): Promise<void> {
          try {
               response.json({ success: true, data: await saleService(request).getHeldSale(String(request.params.heldSaleId)) });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 500).json({ success: false, error: { code: 'HELD_SALE_UNAVAILABLE', message: error.message } });
          }
     }

     static async completeHeldSale(request: Request, response: Response): Promise<void> {
          try {
               const receipt = await saleService(request).completeHeldSale(String(request.params.heldSaleId), request.body, actorOf(request));
               response.status(201).json({ success: true, data: receipt });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : /unavailable|insufficient|positive|Duplicate/.test(error.message) ? 409 : 400;
               response.status(error.code ? 503 : status).json({ success: false, error: { code: error.code ? 'SALE_UNCONFIRMED' : 'HELD_SALE_COMPLETION_REJECTED', message: error.code ? 'Checkout could not be confirmed. Retry the original checkout.' : error.message } });
          }
     }

     static async deleteHeldSale(request: Request, response: Response): Promise<void> {
          try {
               await saleService(request).deleteHeldSale(String(request.params.heldSaleId));
               response.json({ success: true });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 400).json({ success: false, error: { code: 'HELD_SALE_DELETE_REJECTED', message: error.message } });
          }
     }

     static async getSalesHistory(request: Request, response: Response): Promise<void> {
          try {
               const history = await saleService(request).getSalesHistory(listParams(request));
               response.json({ success: true, data: history });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'SALES_HISTORY_UNAVAILABLE', message: error.message } });
          }
     }

     static async getReversedSales(request: Request, response: Response): Promise<void> {
          try {
               const requestedType = String(request.query.type || '');
               const history = await saleService(request).getSalesHistory({
                    ...listParams(request),
                    statuses: PHARMACY_REVERSED_STATUSES,
                    reversalType: (requestedType || undefined) as PharmacySaleReversalType | undefined
               });
               response.json({ success: true, data: history });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'REVERSALS_UNAVAILABLE', message: error.message } });
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
               response.status(error.code ? 503 : status).json({ success: false, error: { code: error.code ? 'SALE_UNCONFIRMED' : 'SALE_REJECTED', message: error.code ? 'Checkout could not be confirmed. Retry the original checkout.' : error.message } });
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
