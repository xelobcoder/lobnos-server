import { Router } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { PharmacyEnterpriseCore, requiredText, json } from '../../models/pharmacy/PharmacyEnterpriseCore';
import { inclusivePharmacyTax } from '../../models/pharmacy/PharmacyTax';
import { pharmacyAccountingDate } from '../../models/pharmacy/PharmacyGeneralLedger';
import { pharmacyFinanceAccess, pharmacyReversalAccess } from './pharmacyAccess.middleware';
import { randomUUID } from 'crypto';
import { branchOf, tenantOf } from './pharmacyContext';
import { pharmacyAccountingLedgerFailure } from './PharmacyAccountingLedgerController';
import { pharmacyAccountingContext, pharmacyAccountingFailure } from './PharmacyAccountingController';

export const pharmacyTaxRouter = Router();
pharmacyTaxRouter.use(pharmacyFinanceAccess);
pharmacyTaxRouter.use((req, res, next) => {
     try { pharmacyAccountingContext(req); next(); }
     catch (error) { pharmacyAccountingFailure(res, error); }
});
pharmacyTaxRouter.get('/tax', async (req, res) => {
     try {
          const branch = branchOf(req); if (!Number.isSafeInteger(branch) || !branch || branch < 1) throw new Error('An authenticated branch is required');
          const db = await KnexConnection(tenantOf(req));
          const from = req.query.from ? pharmacyAccountingDate(req.query.from, 'start date') : undefined;
          const to = req.query.to ? pharmacyAccountingDate(req.query.to, 'end date') : new Date().toISOString().slice(0, 10);
          if (from && from > to) throw new Error('The start date must be on or before the end date');
          const data = await db.transaction(async trx => {
               const rules = await trx('pharmacy_tax_rules').where({ branchid: branch }).orderBy('effective_date', 'desc');
               const query = trx('pharmacy_tax_events').where({ branchid: branch }).where('financial_date', '<=', to);
               if (from) query.where('financial_date', '>=', from);
               const count = await query.clone().count('* as total').first(), total = Number(count?.total || 0);
               if (total > 10000) throw new Error('Tax registers are limited to 10,000 rows. Narrow the date range before viewing or exporting');
               const transactions = await query.orderBy('financial_date', 'desc').orderBy('id');
               return { rules, transactions, total, policy: 'Tax-inclusive selling prices; only explicitly assigned medicines are taxed. Rates are configured by the facility, not inferred.' };
          }, { isolationLevel: 'repeatable read' });
          res.json({ success: true, data });
     } catch (error) { pharmacyAccountingLedgerFailure(res, error); }
});
pharmacyTaxRouter.post('/tax/rules', pharmacyReversalAccess, async (req, res) => {
     try {
          const user = getAuthUser(req), branch = branchOf(req); if (!user || !Number.isSafeInteger(branch) || !branch || branch < 1) throw new Error('An authenticated branch is required');
          const db = await KnexConnection(tenantOf(req)), core = new PharmacyEnterpriseCore(db, { ...user, branch });
          const data = await core.atomic(req.body, 'pharmacy_tax_rule', async trx => {
               const itemId = requiredText(req.body.itemId, 'medicine', 64), reason = requiredText(req.body.reason, 'tax policy approval reason', 1000);
               if (typeof req.body.rate !== 'number') throw new Error('Enter an explicit approved numeric tax rate');
               inclusivePharmacyTax(0, req.body.rate);
               const effectiveDate = pharmacyAccountingDate(req.body.effectiveDate, 'tax effective date');
               if (effectiveDate < new Date().toISOString().slice(0, 10)) throw new Error('Tax policy changes cannot be backdated; reverse or adjust historical tax through approved journals');
               const localAccount = requiredText(req.body.localAccount, 'tax liability account', 100);
               if (!localAccount.startsWith('liability:')) throw new Error('Select an assigned liability account for output tax');
               const item = await trx('pharmacy_inventory_items').where({ id: itemId, branchid: branch }).forUpdate().first();
               if (!item) throw new Error('Medicine does not belong to this pharmacy branch');
               const settings = await trx('pharmacy_accounting_settings').where({ branchid: branch }).forUpdate().first();
               const mapped = json(settings?.mappings)[localAccount];
               if (typeof mapped !== 'string' || !await trx('acc_accounts').where({ account_code: mapped, type: 'liability', is_active: true }).first()) throw new Error('Map the tax liability to an active shared liability account in accounting settings first');
               const id = randomUUID();
               await trx('pharmacy_tax_rules').insert({ id, branchid: branch, item_id: itemId, rate: req.body.rate, local_account: localAccount, effective_date: effectiveDate, reason, created_by: user.employeeid, is_active: true });
               await core.event(trx, 'tax_policy_created', { id, itemId, rate: req.body.rate, localAccount, effectiveDate, reason });
               return { id };
          });
          res.json({ success: true, data });
     } catch (error) { pharmacyAccountingLedgerFailure(res, error); }
});
