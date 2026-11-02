# PLS Pharmacy end-to-end tutorials

These are the eight required task paths. The online manual must link to the precise page procedures at each stage, retain role restrictions and never perform a transaction automatically.

| Tutorial | Actual sequence | Permissions and success evidence |
|---|---|---|
| Sell a medicine | Cashier & Shift > Point of Sale > direct payment/receipt OR counter invoice > Counter invoices payment > medication collection | Selling role; counter payment requires manager/cashier/accountant and handover requires authorized dispensing; successful receipt and collection state |
| Request new stock | Stock Levels > Inventory & purchasing > Submit purchase request > Purchase requests | Stock role; request appears awaiting independent review; stock does not change |
| Purchase medicines | Purchase requests independent approval > approved purchase order > Receive against order > Received deliveries > Invoice matching | Different manager reviews request; authorized receiver records actual delivered base units, batch and expiry; receipt/order quantities and matching evidence agree |
| Pay a supplier | Money we owe suppliers > Supplier bills > register existing receipt if necessary > Settlements > allocations > submit > independent approve > pay > supplier statement | Money role; original bills, actual payment reference and remaining outstanding balances; not an automated transfer |
| Record a pharmacy expense | Expenses > New expense draft > detail evidence > submit > independent approve > pay > payments/evidence | Money role; immutable cost, approved status, actual payment and remaining balance; do not enter stock purchases here |
| Collect money owed by a customer | Customer accounts & invoices > patient > Invoices / collect > invoice > Record collection > receipt | Existing authorized invoice collection; received amount/method/reference, original outstanding balance reduced; no second sale |
| Review pharmacy profit | Financial statements > Profit & loss > dates > Apply filters > revenue/cost/expense rows > source ledger | Money role; applied period agrees with source records; report reading/export does not post |
| Correct a transaction | Identify original record > sales reversal OR unpaid counter cancellation OR controlled financial reversal/refund > independent review when required > verify original and correction evidence | Management for sale reversal; Money for controlled documents; never delete history or duplicate a sale/payment to fix it |

Detailed field instructions and verification must be supplied by the linked online page guides. An end-to-end tutorial is not permission to bypass approval, period locks, stock safety, clinical review or ambiguous-payment retry controls.
