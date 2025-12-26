$filePath = "c:\Programming\PLS-DIFFERENT-VERSIONS\LobnosProfessionalVersion\lobnos-server\src\controllers\inventory\InventoryAnalyticsController.ts"

# Read the entire file
$content = Get-Content -Path $filePath -Raw

# Pattern 1: Update batchUtilization comment to mention inv_consumption_history  
$content = $content -replace `
    '// Batch utilization analysis - using inv_purchase_order_receipts and inv_inventory_transactions', `
    '// Batch utilization analysis - using inv_purchase_order_receipts, inv_inventory_transactions, and inv_consumption_history'

# Pattern 2: Update the LEFT JOIN for inv_inventory_transactions to also include inv_consumption_history using a subquery
# We'll replace the consumed_quantity calculation to use both tables
$oldQuery = @'
                    .leftJoin('inv_inventory_transactions', function () {
                         this.on('inv_purchase_order_receipts.batch_number', '=', 'inv_inventory_transactions.batch_number')
                              .andOn('inv_inventory_transactions.transaction_type', '=', connection.raw("'consumption'"));
                    })
                    .select(
                         'inv_purchase_order_receipts.batch_number',
                         'inv_purchase_order_receipts.expiry_date',
                         'inv_purchase_order_receipts.quantity_received as original_quantity',
                         'inv_inventory_items.id as item_id',
                         'inv_inventory_items.name as item_name',
                         connection.raw('COALESCE(SUM(inv_inventory_transactions.quantity), 0) as consumed_quantity'),
'@

$newQuery = @'
                    .leftJoin('inv_inventory_transactions', function () {
                         this.on('inv_purchase_order_receipts.batch_number', '=', 'inv_inventory_transactions.batch_number')
                              .andOn('inv_inventory_transactions.transaction_type', '=', connection.raw("'consumption'"));
                    })
                    .leftJoin('inv_consumption_history', function () {
                         this.on('inv_purchase_order_receipts.batch_number', '=', 'inv_consumption_history.batch_number')
                              .andOn('inv_purchase_order_items.inventory_item_id', '=', 'inv_consumption_history.item_id');
                    })
                    .select(
                         'inv_purchase_order_receipts.batch_number',
                         'inv_purchase_order_receipts.expiry_date',
                         'inv_purchase_order_receipts.quantity_received as original_quantity',
                         'inv_inventory_items.id as item_id',
                         'inv_inventory_items.name as item_name',
                         connection.raw('(COALESCE(SUM(DISTINCT inv_inventory_transactions.quantity), 0) + COALESCE(SUM(DISTINCT inv_consumption_history.quantity), 0)) as consumed_quantity'),
'@

$content = $content -replace [regex]::Escape($oldQuery), $newQuery

# Pattern 3: Update items_by_batch mapping to use batchUtilization
$oldMapping = @'
                    items_by_batch: expiringBatches.map(row => ({
                         batch_number: row.batch_number,
                         item_id: row.item_id,
                         item_name: row.item_name,
                         total_received: parseInt(row.batch_quantity), // Simplified
                         total_consumed: 0, // Would need consumption tracking
                         remaining_quantity: parseInt(row.batch_quantity),
                         expiry_date: row.expiry_date,
                         days_until_expiry: parseInt(row.days_until_expiry),
                         status: row.days_until_expiry <= 7 ? 'expired' : row.days_until_expiry <= 30 ? 'near_expiry' : 'fresh'
                    })),
'@

$newMapping = @'
                    items_by_batch: expiringBatches.map(row => {
                         const utilization = batchUtilization.find(bu => bu.batch_number === row.batch_number);
                         const totalConsumed = utilization ? parseFloat(utilization.consumed_quantity) : 0;
                         const totalReceived = parseInt(row.batch_quantity);
                         const remainingQty = totalReceived - totalConsumed;
                         
                         return {
                              batch_number: row.batch_number,
                              item_id: row.item_id,
                              item_name: row.item_name,
                              total_received: totalReceived,
                              total_consumed: totalConsumed,
                              remaining_quantity: Math.max(0, remainingQty),
                              expiry_date: row.expiry_date,
                              days_until_expiry: parseInt(row.days_until_expiry),
                              status: row.days_until_expiry <= 7 ? 'expired' : row.days_until_expiry <= 30 ? 'near_expiry' : 'fresh'
                         };
                    }),
'@

$content = $content -replace [regex]::Escape($oldMapping), $newMapping

# Write back to file
$content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline

Write-Host "Successfully updated InventoryAnalyticsController.ts"
Write-Host "Changes made:"
Write-Host "1. Updated batchUtilization query to include inv_consumption_history table"
Write-Host "2. Updated items_by_batch mapping to calculate total_consumed from batchUtilization"
Write-Host "3. Fixed remaining_quantity to be total_received - total_consumed"
