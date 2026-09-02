export type PharmacyStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

/**
 * Single source of truth for stock status. `inv_inventory_items.status` is a stored enum that
 * inventory screens read directly, so every write to `current_stock` must recompute it too.
 */
export function resolveStockStatus(currentStock: number, minimumStock: number): PharmacyStockStatus {
     if (currentStock <= 0) return 'out_of_stock';
     if (currentStock <= minimumStock) return 'low_stock';
     return 'in_stock';
}
