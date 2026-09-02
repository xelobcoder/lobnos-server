import {
     IPharmacyCatalogueRepository,
     PharmacyCataloguePageRequest
} from '../interfaces/IPharmacyCatalogueRepository';
import { IPharmacyCatalogueService, PharmacyCatalogueListing, PharmacyStockOverview } from '../interfaces/IPharmacyCatalogueService';
import { PHARMACY_DEFAULT_PAGE_SIZE, PHARMACY_MAX_PAGE_SIZE } from '../constants/pharmacy.constants';

export class PharmacyCatalogueService implements IPharmacyCatalogueService {
     constructor(private readonly catalogueRepository: IPharmacyCatalogueRepository) { }

     async getCatalogue(request: PharmacyCataloguePageRequest = {}): Promise<PharmacyCatalogueListing> {
          const { page, count } = this.resolvePaging(request);
          const pageResult = await this.catalogueRepository.findPage({ ...request, page, count });
          return this.toListing(pageResult.items, pageResult.total, page, count);
     }

     async getStockOverview(request: PharmacyCataloguePageRequest = {}): Promise<PharmacyStockOverview> {
          const { page, count } = this.resolvePaging(request);

          const [pageResult, summary] = await Promise.all([
               this.catalogueRepository.findPage({ ...request, page, count }),
               this.catalogueRepository.summarise(request)
          ]);

          return { ...this.toListing(pageResult.items, pageResult.total, page, count), summary };
     }

     private resolvePaging(request: PharmacyCataloguePageRequest): { page: number; count: number } {
          return {
               page: Math.max(1, Number(request.page) || 1),
               count: Math.min(PHARMACY_MAX_PAGE_SIZE, Math.max(1, Number(request.count) || PHARMACY_DEFAULT_PAGE_SIZE))
          };
     }

     private toListing(items: PharmacyCatalogueListing['items'], total: number, page: number, count: number): PharmacyCatalogueListing {
          return { items, total, page, count, totalPages: Math.max(1, Math.ceil(total / count)) };
     }
}
