# Pharmacy financial corrections, pricing and analytics

Pharmacy inventory and books remain separate from laboratory inventory and accounting. All operations and reports use the authenticated branch and employee.

## Reopen a mistaken close

In **Pharmacy → Finances**, a pharmacy manager or administrator can select **Reopen a closed day**, choose today's or a previous closed date, and enter a reason of at least ten characters. Reopening preserves the previous closer, close time and financial-day events. Each subsequent close records a journal-balance snapshot. Existing closed shifts, handovers, receipts and payments are retained.

Reopening today's day permits normal operations after opening a new cashier shift. Reopening an older day permits correction journals explicitly dated to that day. It does not backdate new sales or reopen old cashier shifts. Choose the historical financial date in **Journals**, post the reviewed balanced correction, and close that date again. Later days remain intact. Future dates are rejected; reopening retries do not duplicate audit events.

## Retail and wholesale prices

Maintain both prices per base selling unit when creating or managing a medicine. At POS choose the default price for newly added medicines, or choose Retail/Wholesale on each basket line. The server loads the selected configured price; submitted prices cannot override it. A missing wholesale price blocks wholesale selling rather than becoming a zero-price sale.

Held sales and receipts retain the selected price basis. Checkout retries must match the original request, including its price choices. Expected totals detect price changes before payment. Refunds use the prices and costs captured by the original receipt.

## Analytics

**Pharmacy → Analytics & Reports** provides overview trends, sales and margins, stock/replenishment, batch expiry, purchase-order fulfilment, supplier performance, stock movements, and pharmacy financial accounts. Reports have date/search filters, pagination and full CSV export. Reports run in a repeatable-read transaction, so their totals and rows share a database snapshot.

Sales and refunds use their respective event dates. Cost reversals apply only to goods restored to stock. Book profit includes correction journals; receipt-based net sales can therefore differ from book revenue. Stock valuation and expiry are current snapshots, independent of historical date filters. Reorder quantities and days of cover use dispensable stock, excluding expired or untraceable tracked stock. Supplier fill rate averages line fulfilment percentages, avoiding quantity weighting across different medicines.

Managers/accountants can access financial reports. Storekeepers can access stock, expiry, purchasing and movement reports without receiving sales/profit summary fields. CSV exports include the full filtered report and escape cells that could be interpreted as spreadsheet formulas.

## Deployment

Apply `20261024_pharmacy_price_types` or run the normal backend startup bootstrap before serving the updated POS. This adds `price_type` to sale and held-sale lines; existing lines default to retail. No historical financial day is reopened automatically.
