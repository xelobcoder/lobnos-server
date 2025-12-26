const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Programming\\PLS-DIFFERENT-VERSIONS\\LobnosProfessionalVersion\\lobnos-server\\src\\controllers\\inventory\\InventoryAnalyticsController.ts';

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// First, let's add the batch consumption query right after the expiredBatches query (before batchExpiryDistribution)
const batchConsumptionQuery = `
                // Get batch consumption data from inv_consumption_history
                const batchConsumption = await connection('inv_purchase_order_receipts')
                     .leftJoin('inv_purchase_order_items', 'inv_purchase_order_receipts.order_item_id', 'inv_purchase_order_items.id')
                     .leftJoin('inv_consumption_history', function() {
                          this.on('inv_consumption_history.batch_number', '=', 'inv_purchase_order_receipts.batch_number')
                               .andOn('inv_consumption_history.item_id', '=', 'inv_purchase_order_items.inventory_item_id');
                     })
                     .select(
                          'inv_purchase_order_receipts.batch_number',
                          connection.raw('COALESCE(SUM(inv_consumption_history.quantity), 0) as consumed_quantity')
                     )
                     .whereNotNull('inv_purchase_order_receipts.batch_number')
                     .groupBy('inv_purchase_order_receipts.batch_number') as any[];
`;

// Find and replace: insert batch consumption query before "// Batch expiry distribution"
content = content.replace(
     /(\r?\n\s*)(\/\/ Batch expiry distribution - using inv_purchase_order_receipts)/,
     `$1${batchConsumptionQuery}$1$2`
);

// Second, update the items_by_batch mapping
const oldMapping = `items_by_batch: expiringBatches.map(row => ({
                         batch_number: row.batch_number,
                         item_id: row.item_id,
                         item_name: row.item_name,
                         total_received: parseInt(row.batch_quantity), // Simplified
                         total_consumed: 0, // Would need consumption tracking
                         remaining_quantity: parseInt(row.batch_quantity),
                         expiry_date: row.expiry_date,
                         days_until_expiry: parseInt(row.days_until_expiry),
                         status: row.days_until_expiry <= 7 ? 'expired' : row.days_until_expiry <= 30 ? 'near_expiry' : 'fresh'
                    })),`;

const newMapping = `items_by_batch: expiringBatches.map(row => {
                         const consumption = batchConsumption.find(bc => bc.batch_number === row.batch_number);
                         const totalConsumed = consumption ? parseFloat(consumption.consumed_quantity) : 0;
                         const totalReceived = parseInt(row.batch_quantity);
                         const remainingQty = totalReceived - totalConsumed;
                         
                         return {
                              batch_number: row.batch_number,
                              item_id: row.item_id,
                              item_name: row.item_name,
                              total_received: totalReceived,
                              total_consumed: totalConsumed,
                              remaining_quantity: Math.max(0, remainingQty), // Ensure non-negative
                              expiry_date: row.expiry_date,
                              days_until_expiry: parseInt(row.days_until_expiry),
                              status: row.days_until_expiry <= 7 ? 'expired' : row.days_until_expiry <= 30 ? 'near_expiry' : 'fresh'
                         };
                    }),`;

content = content.replace(oldMapping, newMapping);

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Successfully updated InventoryAnalyticsController.ts');
console.log('Changes made:');
console.log('1. Added batch consumption query using inv_consumption_history table');
console.log('2. Updated items_by_batch mapping to calculate total_consumed and remaining_quantity');
