# Expense and outsourcing workflow changes

The organization profile's Services tab now offers a single editable catalogue. Select tests individually or select all matching tests, enter costs and turnaround times, and save together. Only changed rows are sent. The backend checks each panel version and commits the batch atomically. Removing a selection disables that organization for the test; other partner configurations and existing case cost snapshots remain intact. Selecting a preferred partner clears other preferred selections for that test.

Both expense list routes now use the same workspace, with My expenses, Awaiting approval, Awaiting payment, Paid and Rejected views. Approval and payment status are separate, with paid and outstanding amounts shown. Reviewers can inspect supporting documents and approve or reject selected eligible rows. Available actions come from the backend's authority and branch controls. Creation and editing share the responsive form. An attachment failure after saving does not create another expense: the saved expense remains visible with an attachment retry.

Editing uses the scoped expense ID, locks the row, checks ownership and financial finalization, and resubmits editable expenses for approval with an audit action. Approved expenses remain immutable. Payment reversal and legacy query-based handlers derive their employee, tenant and operating branch from the authenticated session.

## Receipt rollout

New receipts are stored in `private/expense-receipts/<tenantId>` under the server working directory. Include this directory in backups, keep it on persistent storage, and deny direct web-server access to it. The application blocks the former `/uploads/expenses/receipts` public path; deployments serving `public` directly through nginx or another proxy must block that path there too. Receipt reading, uploading and deletion use authenticated tenant and expense ownership checks. Approved expense evidence cannot be deleted. Supported documents are PDF, JPEG, PNG and WebP, up to 5 MB per file and 10 per request.

Older receipt filenames contain only the expense ID, so files in the shared legacy directory cannot safely be assigned to a tenant automatically. They remain intact and are no longer publicly served. Review ownership and prepare a manifest:

```json
[{ "tenantId": 3, "expenseId": 42, "filename": "42-1790000000000.jpg" }]
```

Validate with the normal backend environment loaded:

```powershell
node --require ts-node/register scripts/import-expense-receipts.ts manifest.json
node --require ts-node/register scripts/import-expense-receipts.ts manifest.json --apply
```

The importer verifies expense existence, filename boundaries and document signatures before copying. It is idempotent and preserves originals. Import only mappings whose tenant ownership has been confirmed.
