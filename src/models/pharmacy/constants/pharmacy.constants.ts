export const PHARMACY_ROLES = [
     'pharmacy_cashier',
     'pharmacy_manager',
     'pharmacy_storekeeper',
     'pharmacy_dispensary_officer'
] as const;

export const PHARMACY_CATEGORY_ID = 'CAT-PHARMACY';
export const PHARMACY_CATEGORY_NAME = 'Pharmacy';

/** SQL predicate matching pharmacy items at or below their reorder level; expects the items table aliased as `item`. */
export const LOW_STOCK_CONDITION = 'item.current_stock <= COALESCE(item.min_stock, 0)';

export const PHARMACY_DEFAULT_PAGE_SIZE = 20;
export const PHARMACY_MAX_PAGE_SIZE = 200;

/** Whitelist mapping sortable API fields to their columns; never interpolate raw client input into ORDER BY. */
export const PHARMACY_SORT_COLUMNS = {
     name: 'item.name',
     sku: 'item.sku',
     salePrice: 'item.sale_price',
     availableStock: 'item.current_stock',
     minimumStock: 'item.min_stock'
} as const;

export const PHARMACY_DEFAULT_SORT_FIELD = 'name';
export const PHARMACY_DEFAULT_SORT_DIRECTION = 'asc';