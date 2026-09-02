import {
     PharmacyCatalogueItem,
     PharmacyCataloguePageRequest,
     PharmacyStockSummary
} from './IPharmacyCatalogueRepository';

export interface PharmacyCatalogueListing {
     items: PharmacyCatalogueItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

export interface PharmacyStockOverview extends PharmacyCatalogueListing {
     summary: PharmacyStockSummary;
}

export interface IPharmacyCatalogueService {
     /** Paginated pharmacy item listing, including items that cannot currently be sold. */
     getCatalogue(request?: PharmacyCataloguePageRequest): Promise<PharmacyCatalogueListing>;
     /** Paginated stock listing with whole-set counts, used by the pharmacy stock screens. */
     getStockOverview(request?: PharmacyCataloguePageRequest): Promise<PharmacyStockOverview>;
}
