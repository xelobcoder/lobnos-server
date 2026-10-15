export const PHARMACY_ROLES = [
     'pharmacy_cashier',
     'pharmacy_manager',
     'pharmacy_storekeeper',
     'pharmacy_dispensary_officer'
] as const;

export const PHARMACY_ACCESS_ROLES = ['super-admin', 'admin', 'manager', ...PHARMACY_ROLES];

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

export const PHARMACY_SALE_STATUS_COMPLETED = 'completed';

/** Reversal intent, and the terminal sale status each one lands on. */
export const PHARMACY_REVERSAL_STATUSES = {
     refund: 'refunded',
     void: 'voided',
     cancel: 'cancelled'
} as const;

/** Every terminal status produced by a reversal, used to list refunded/voided/cancelled sales. */
export const PHARMACY_REVERSED_STATUSES = Object.values(PHARMACY_REVERSAL_STATUSES) as string[];

/** Reversing a sale is a privileged correction, not a cashier action. */
export const PHARMACY_REVERSAL_ROLES = ['super-admin', 'admin', 'manager', 'pharmacy_manager'];

export const PHARMACY_REVERSAL_MIN_REASON_LENGTH = 5;
export const PHARMACY_REVERSAL_MAX_REASON_LENGTH = 500;