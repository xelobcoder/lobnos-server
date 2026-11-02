# Pharmacy Learning Center information architecture

Keep `/pharmacy/guide` as the entry point. Give each focused topic a stable `/pharmacy/guide/[slug]` URL. Existing guide anchors should remain usable as category anchors on the index.

## Categories

1. Getting started: welcome, dashboard, menu, responsibilities, first day.
2. Sales and dispensing: POS, selling, counter invoices, collections, refunds, customer credit, history.
3. Medicines and stock: medicine registration, categories, quantities, batches, adjustments, low stock, movements.
4. Purchasing and suppliers: requests, creation, decisions, orders, receiving, supplier bills, payments, partial receipts, returns.
5. Pharmacy accounting: introduction, money movements, accounts, ledger, shared records, customer/supplier balances, expenses, cost of sales, profit, statements, checks, journals, reconciliation, periods.
6. Reports and analytics: analytics, sales, stock, supplier reports, statements, exports.

## Article layout

Left: searchable category/topic navigation, filtered by existing page permissions.
Center: one article with purpose, value, scenario, numbered steps, outcome, mistakes and related topics.
Right: links to article sections on wide screens; inline contents on smaller screens.

Include breadcrumbs, previous/next within the reader's accessible path, a voluntary read marker with explicit local-device persistence, and advanced explanations collapsed by default. Never persist financial data in learning progress.

Role paths recommend tasks for pharmacist/dispensing, storekeeper, manager, accountant and administrator. Recommendations do not widen authorization. Unknown roles fail closed.
