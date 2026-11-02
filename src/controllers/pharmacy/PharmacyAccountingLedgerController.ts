import { Request, Response, Router } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { branchOf, tenantOf } from './pharmacyContext';
import { pharmacyFinanceAccess, pharmacyReversalAccess } from './pharmacyAccess.middleware';
import { pharmacyAccountingDate, pharmacyGeneralLedger } from '../../models/pharmacy/PharmacyGeneralLedger';
import { synchronizePharmacyJournal } from '../../models/pharmacy/PharmacyAccountingBridge';
import { getAuthUser } from '../../middleware/authority';
import { PharmacyEnterpriseCore, requiredText } from '../../models/pharmacy/PharmacyEnterpriseCore';
import { PHARMACY_CONSOLIDATION_REVIEW_LIMIT, pharmacyConsolidationReconciliation } from '../../models/pharmacy/PharmacyConsolidationReconciliation';
import { Workbook } from 'exceljs';
import { financialReports, pharmacyFinancialReport } from '../../models/pharmacy/PharmacyFinancialReports';
import { pharmacyAnalyticsFilters } from '../../models/pharmacy/PharmacyAnalytics';
import { pharmacyInventoryReconciliation } from '../../models/pharmacy/PharmacyInventoryReconciliation';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
import { pharmacyAccountDisplay } from '../../models/pharmacy/PharmacyAccountDisplay';
import { pharmacyAccountingContext, pharmacyAccountingFailure } from './PharmacyAccountingController';

export const pharmacyAccountingLedgerRouter = Router();
pharmacyAccountingLedgerRouter.use(pharmacyFinanceAccess);
pharmacyAccountingLedgerRouter.use((req, res, next) => {
     try { pharmacyAccountingContext(req); next(); }
     catch (error) { pharmacyAccountingFailure(res, error); }
});
function reject(res: Response, error: unknown) {
     if (error instanceof AccountingError) return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
     if (error && typeof error === 'object' && ('sql' in error || 'sqlMessage' in error || 'errno' in error || 'code' in error)) return res.status(500).json({ success: false, error: { code: 'PHARMACY_ACCOUNTING_FAILED', message: 'Accounting data could not be processed; no changes were committed' } });
     const message = error instanceof Error ? error.message : 'Pharmacy accounting operation failed';
     return res.status(400).json({ success: false, error: { code: 'PHARMACY_ACCOUNTING_REJECTED', message } });
}
export { reject as pharmacyAccountingLedgerFailure };
pharmacyAccountingLedgerRouter.get('/inventory/reconciliation', async (req: Request, res: Response) => {
     try {
          const db = await KnexConnection(tenantOf(req));
          const data = await db.transaction(trx => pharmacyInventoryReconciliation(trx, branchOf(req)!), { isolationLevel: 'repeatable read' });
          res.json({ success: true, data });
     } catch (error) { reject(res, error); }
});
pharmacyAccountingLedgerRouter.get('/posted-journals/:id', async (req: Request, res: Response) => {
     try {
          const db = await KnexConnection(tenantOf(req)), branch = branchOf(req)!;
          if (typeof req.params.id !== 'string' || !req.params.id.trim() || req.params.id.length > 64) throw new Error('Select a posted pharmacy journal');
          const data = await db.transaction(async trx => {
               const journal = await trx('pharmacy_journals').where({ id: req.params.id, branchid: branch }).first();
               if (!journal) throw new AccountingError('Posted pharmacy journal not found in this branch', 'JOURNAL_NOT_FOUND', 404);
               const lines = await trx('pharmacy_journal_lines').where({ journal_id: journal.id }).orderBy('id');
               const names = await pharmacyAccountDisplay(trx, branch, lines.map(line => String(line.account_code)));
               const link = await trx('pharmacy_accounting_posting_links').where({ journal_id: journal.id, branchid: branch }).first();
               return { ...journal, status: 'posted', business_unit: 'pharmacy', sharedEntryId: link?.shared_entry_id || null,
                    lines: lines.map(line => ({ ...line, account: line.account_code, account_name: names.get(line.account_code)?.name, debit: Number(line.debit), credit: Number(line.credit), source_document: line.document_ref || journal.source_ref })),
                    immutable: true };
          }, { isolationLevel: 'repeatable read' });
          res.json({ success: true, data });
     } catch (error) { reject(res, error); }
});
pharmacyAccountingLedgerRouter.get('/ledger', async (req: Request, res: Response) => {
     try {
          const db = await KnexConnection(tenantOf(req));
          const data = await db.transaction(trx => pharmacyGeneralLedger(trx, branchOf(req)!, req.query), { isolationLevel: 'repeatable read' });
          res.json({ success: true, data });
     } catch (error) { reject(res, error); }
});
pharmacyAccountingLedgerRouter.get('/ledger/export', async (req: Request, res: Response) => {
     try {
          const db = await KnexConnection(tenantOf(req));
          const data = await db.transaction(trx => pharmacyGeneralLedger(trx, branchOf(req)!, { ...req.query, all: true }), { isolationLevel: 'repeatable read' });
          const workbook = new Workbook(), sheet = workbook.addWorksheet('Pharmacy general ledger');
          sheet.columns = [
               { header: 'Posting date', key: 'date', width: 15 }, { header: 'Journal reference', key: 'journal_id', width: 38 },
               { header: 'Account code', key: 'account', width: 24 }, { header: 'Account name', key: 'account_name', width: 28 },
               { header: 'Description', key: 'description', width: 45 }, { header: 'Source document', key: 'source_document', width: 38 },
               { header: 'Business unit', key: 'business_unit', width: 16 }, { header: 'Branch', key: 'branchid', width: 12 },
               { header: 'Debit (GHS)', key: 'debit', width: 18 }, { header: 'Credit (GHS)', key: 'credit', width: 18 },
               { header: 'Running balance (GHS)', key: 'running_balance', width: 24 },
          ];
          for (const row of data.rows) sheet.addRow({ ...row, date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10) });
          for (const key of ['debit', 'credit', 'running_balance']) sheet.getColumn(key).numFmt = '#,##0.00;[Red](#,##0.00)';
          sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
          const content = await workbook.xlsx.writeBuffer();
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename="pharmacy-general-ledger.xlsx"');
          res.send(Buffer.from(content));
     } catch (error) { reject(res, error); }
});
pharmacyAccountingLedgerRouter.get('/reports/export', async (req: Request, res: Response) => {
     try {
          const filters = pharmacyAnalyticsFilters({ ...req.query, report: req.query.report || 'trial_balance' });
          if (!financialReports.includes(filters.report)) throw new Error('Select an accounting financial statement');
          const db = await KnexConnection(tenantOf(req));
          const data = await db.transaction(trx => pharmacyFinancialReport(trx, branchOf(req)!, filters, true), { isolationLevel: 'repeatable read' });
          if (data.rows.length > 10000) throw new Error('Statement exports are limited to 10,000 rows. Narrow the date range');
          const workbook = new Workbook(), sheet = workbook.addWorksheet('Pharmacy statement');
          sheet.columns = data.columns.map(column => ({ header: column.label, key: column.key, width: column.format === 'money' ? 22 : 30 }));
          for (const row of data.rows) sheet.addRow(row);
          for (const column of data.columns) if (column.format === 'money') sheet.getColumn(column.key).numFmt = '#,##0.00;[Red](#,##0.00)';
          sheet.addRow({});
          for (const [label, value] of Object.entries(data.totals)) sheet.addRow([label, value]);
          sheet.getRow(1).font = { bold: true };
          const content = await workbook.xlsx.writeBuffer();
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="pharmacy-${filters.report}.xlsx"`);
          res.send(Buffer.from(content));
     } catch (error) { reject(res, error); }
});
pharmacyAccountingLedgerRouter.get('/consolidation/reconciliation', async (req: Request, res: Response) => {
     try {
          const db = await KnexConnection(tenantOf(req));
          const data = await db.transaction(trx => pharmacyConsolidationReconciliation(trx, branchOf(req)!, {
               from: req.query.from ? String(req.query.from) : undefined, to: req.query.to ? String(req.query.to) : undefined,
          }), { isolationLevel: 'repeatable read' });
          res.json({ success: true, data });
     } catch (error) { reject(res, error); }
});
pharmacyAccountingLedgerRouter.get('/consolidation', async (req: Request, res: Response) => {
     try {
          const db = await KnexConnection(tenantOf(req)), branch = branchOf(req)!;
          const from = req.query.from ? pharmacyAccountingDate(req.query.from, 'start date') : undefined, to = req.query.to ? pharmacyAccountingDate(req.query.to, 'end date') : undefined;
          if (from && to && from > to) throw new Error('The start date must be on or before the end date');
          const data = await db.transaction(async trx => {
               const pending = trx('pharmacy_journals as j').leftJoin('pharmacy_accounting_posting_links as p', 'p.journal_id', 'j.id')
                    .where('j.branchid', branch).whereNull('p.journal_id');
               if (from) pending.where('j.financial_date', '>=', from);
               if (to) pending.where('j.financial_date', '<=', to);
               const pendingTotal = await pending.clone().count('* as total').first();
               const missing = await pending.select('j.id', 'j.financial_date', 'j.kind', 'j.description').orderBy('j.id').limit(PHARMACY_CONSOLIDATION_REVIEW_LIMIT);
               const linked = await trx('pharmacy_accounting_posting_links').where({ branchid: branch }).count('* as total').first();
               return { from: from || null, to: to || null, linked: Number(linked?.total || 0), unlinked: Number(pendingTotal?.total || 0), truncated: Number(pendingTotal?.total || 0) > PHARMACY_CONSOLIDATION_REVIEW_LIMIT, reviewLimit: PHARMACY_CONSOLIDATION_REVIEW_LIMIT, items: missing, note: 'Unlinked journals are not included in the shared GL. Review mappings, periods and opening balances before consolidation. Submit only the explicitly reviewed source IDs, then reload the next bounded review batch.' };
          }, { isolationLevel: 'repeatable read' });
          res.json({ success: true, data });
     } catch (error) { reject(res, error); }
});
pharmacyAccountingLedgerRouter.post('/consolidation', pharmacyReversalAccess, async (req: Request, res: Response) => {
     try {
          if (req.body.confirmed !== true) throw new Error('Confirm the reviewed consolidation and account mappings');
          const reason = requiredText(req.body.reason, 'consolidation review reason', 1000);
          const from = pharmacyAccountingDate(req.body.from, 'start date'), to = pharmacyAccountingDate(req.body.to, 'end date');
          if (from > to) throw new Error('The start date must be on or before the end date');
          const journalIds: unknown = req.body.journalIds;
          if (journalIds !== undefined && (!Array.isArray(journalIds) || !journalIds.length || journalIds.length > 2000 || new Set(journalIds).size !== journalIds.length || journalIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 64))) throw new Error('Select 1-2,000 distinct reviewed source journal IDs');
          const db = await KnexConnection(tenantOf(req)), branch = branchOf(req)!;
          const user = getAuthUser(req);
          if (!user) throw new Error('An authenticated accounting employee is required');
          const core = new PharmacyEnterpriseCore(db, { ...user, branch });
          const data = await core.atomic(req.body, 'accounting_consolidation', async trx => {
               const settings = await trx('pharmacy_accounting_settings').where({ branchid: branch }).forUpdate().first();
               if (!settings || !Number(settings.enabled) || Number(settings.tenant_id) !== tenantOf(req)) throw new Error('Enable mapped pharmacy GL posting for this tenant and branch first');
               const query = trx('pharmacy_journals').where({ branchid: branch }).whereBetween('financial_date', [from, to]).orderBy('financial_date').orderBy('id').limit(2001).forUpdate();
               if (Array.isArray(journalIds)) query.whereIn('id', journalIds);
               const journals = await query;
               if (journals.length > 2000) throw new Error('Consolidate at most 2,000 source journals at a time; narrow the date range');
               if (Array.isArray(journalIds) && journals.length !== journalIds.length) throw new Error('A selected source journal is outside the authenticated branch or reviewed date range');
               const preflight = await pharmacyConsolidationReconciliation(trx, branch, { from, to });
               if (preflight.unlinkedShared || preflight.linkedMismatchCount) throw new AccountingError('Resolve unlinked shared entries and existing linked posting differences before consolidating more sources', 'CONSOLIDATION_RECONCILIATION_REQUIRED', 409);
               let posted = 0, existing = 0;
               for (const journal of journals) {
                    if (await trx('pharmacy_accounting_posting_links').where({ journal_id: journal.id, branchid: branch }).first()) { existing++; continue; }
                    const lines = await trx('pharmacy_journal_lines').where({ journal_id: journal.id });
                    await synchronizePharmacyJournal(trx, journal, lines.map(line => ({ account: line.account_code, debit: Number(line.debit), credit: Number(line.credit), documentRef: line.document_ref || undefined })), { historical: true });
                    posted++;
               }
               await core.event(trx, 'accounting_consolidation', { posted, existing, from, to, reason });
               return { posted, existing, from, to };
          });
          res.json({ success: true, data });
     } catch (error) { reject(res, error); }
});
