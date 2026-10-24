import { Request, Response } from 'express';
import { PharmacyCatalogueRepository } from '../../models/pharmacy/repositories/PharmacyCatalogueRepository';
import { PharmacyCatalogueService } from '../../models/pharmacy/services/PharmacyCatalogueService';
import {
     PharmacyCatalogueSortField,
     PharmacySortDirection
} from '../../models/pharmacy/interfaces/IPharmacyCatalogueRepository';
import { tenantOf, branchOf } from './pharmacyContext';

const catalogueService = (request: Request) => new PharmacyCatalogueService(new PharmacyCatalogueRepository(tenantOf(request), branchOf(request)));

const pagingParams = (request: Request) => ({
     page: Number(request.query.page || 1),
     count: Number(request.query.count || 10),
     sortBy: request.query.sortBy as PharmacyCatalogueSortField | undefined,
     sortDirection: request.query.sortDirection as PharmacySortDirection | undefined
});

export class PharmacyCatalogueController {
     static async getCatalogue(request: Request, response: Response): Promise<void> {
          try {
               const listing = await catalogueService(request).getCatalogue({
                    ...pagingParams(request),
                    search: String(request.query.search || ''),
                    sellableOnly: request.query.sellableOnly === 'true'
               });
               response.json({ success: true, data: listing });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'CATALOGUE_UNAVAILABLE', message: error.message } });
          }
     }

     static async getStock(request: Request, response: Response): Promise<void> {
          try {
               const overview = await catalogueService(request).getStockOverview({
                    ...pagingParams(request),
                    search: String(request.query.search || ''),
                    lowStockOnly: request.query.filter === 'low'
               });
               response.json({ success: true, data: overview });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'STOCK_UNAVAILABLE', message: error.message } });
          }
     }
}
