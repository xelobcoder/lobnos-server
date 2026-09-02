export type PharmacyStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface PharmacyCatalogueItem {
     inventoryItemId: string;
     sku: string;
     name: string;
     unit: string;
     availableStock: number;
     minimumStock: number;
     salePrice: number;
     stockStatus: PharmacyStockStatus;
}

export type PharmacyCatalogueSortField = 'name' | 'sku' | 'salePrice' | 'availableStock' | 'minimumStock';
export type PharmacySortDirection = 'asc' | 'desc';

export interface PharmacyCatalogueFilters {
     search?: string;
     /** Excludes items that carry no stock or no sale price. */
     sellableOnly?: boolean;
     /** Restricts results to items at or below their minimum stock threshold. */
     lowStockOnly?: boolean;
}

export interface PharmacyCataloguePageRequest extends PharmacyCatalogueFilters {
     page?: number;
     count?: number;
     sortBy?: PharmacyCatalogueSortField;
     sortDirection?: PharmacySortDirection;
}

export interface PharmacyCataloguePage {
     items: PharmacyCatalogueItem[];
     total: number;
}

export interface PharmacyStockSummary {
     totalItems: number;
     inStock: number;
     lowStock: number;
     outOfStock: number;
}

export interface IPharmacyCatalogueRepository {
     /** Returns a single page of matching items alongside the unpaginated total. */
     findPage(request?: PharmacyCataloguePageRequest): Promise<PharmacyCataloguePage>;
     /** Counts matching items grouped by stock status across the whole filtered set. */
     summarise(filters?: PharmacyCatalogueFilters): Promise<PharmacyStockSummary>;
}