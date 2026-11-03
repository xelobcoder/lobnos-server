import { Knex } from 'knex';
import { json } from './PharmacyEnterpriseCore';
import { DEFAULT_PHARMACY_ACCOUNTS, PHARMACY_CONTROL_ACCOUNTS } from './accounting/PharmacyLocalChart';

export interface PharmacyAccountPresentation { number: string | null; name: string; normalBalance: 'debit' | 'credit' | null }

const humanize = (code: string) => {
     const words = code.replace(/[:_]+/g, ' ').trim();
     return words ? words.charAt(0).toUpperCase() + words.slice(1) : code;
};
// The local chart and the facility ledger are optional on older or standalone installations.
async function optionalRows(query: Promise<any[]>): Promise<any[]> {
     try { return (await query) || []; }
     catch (error: any) { if (error?.code === 'ER_NO_SUCH_TABLE' || /no such table/i.test(String(error?.message))) return []; throw error; }
}

export async function pharmacyAccountDisplay(db: Knex | Knex.Transaction, branch: number, codes: string[]): Promise<Map<string, PharmacyAccountPresentation>> {
     const settings = await db('pharmacy_accounting_settings').where({ branchid: branch }).first();
     const mappings = json(settings?.mappings) as Record<string, unknown>;
     const party = (prefix: string) => codes.filter(code => code.startsWith(prefix)).map(code => code.slice(prefix.length));
     const collectionIds = party('collection:').map(Number).filter(Number.isInteger), supplierIds = party('payable:'), customerIds = party('receivable:').map(Number).filter(Number.isInteger);
     const [destinations, suppliers, customers] = await Promise.all([
          collectionIds.length ? db('pharmacy_collection_accounts').where({ branchid: branch }).whereIn('id', collectionIds).select('id', 'name', 'account_type') : [],
          supplierIds.length ? db('pharmacy_suppliers').whereIn('id', supplierIds).select('id', 'name') : [],
          customerIds.length ? db('pharmacy_customer_accounts').where({ branchid: branch }).whereIn('id', customerIds).select('id', 'patient_id') : [],
     ]) as [any[], any[], any[]];
     const destination = (code: string) => code.startsWith('collection:') ? destinations.find(row => Number(row.id) === Number(code.slice(11))) : undefined;
     const control = (code: string) => {
          const collection = destination(code);
          if (collection) return PHARMACY_CONTROL_ACCOUNTS[`collection:${collection.account_type}`] || PHARMACY_CONTROL_ACCOUNTS['collection:cash'];
          return PHARMACY_CONTROL_ACCOUNTS[code] || PHARMACY_CONTROL_ACCOUNTS[code.split(':')[0]];
     };
     const mapped = new Map(codes.map(code => {
          const category = code.startsWith('collection:') ? destination(code)?.account_type : code === 'supplier_payable' ? 'payable' : code.split(':')[0];
          return [code, mappings[code] || (category ? mappings[category] : undefined)];
     }));
     const sharedCodes = [...new Set([...mapped.values()].filter((code): code is string => typeof code === 'string'))];
     const local = codes.length ? await optionalRows(db('pharmacy_local_accounts').where({ branchid: branch }).whereIn('local_code', codes).select('local_code', 'account_code', 'name', 'normal_balance')) : [];
     const shared = sharedCodes.length ? await optionalRows(db('acc_accounts').whereIn('account_code', sharedCodes).select('account_code', 'name', 'normal_balance')) : [];
     const linked = Number(settings?.enabled) === 1 || settings?.enabled === true;
     return new Map(codes.map(code => {
          const custom = local.find(row => row.local_code === code);
          const facility = shared.find(row => row.account_code === mapped.get(code));
          const standard = DEFAULT_PHARMACY_ACCOUNTS.find(row => row.account_code === code);
          const controlAccount = standard ? undefined : control(code);
          const own = standard ? { number: standard.account_number, name: standard.name, normal: standard.normal_balance }
               : controlAccount ? { number: controlAccount.account_number, name: controlAccount.name, normal: controlAccount.normal_balance } : undefined;
          const base = custom ? { number: String(custom.account_code), name: String(custom.name), normal: custom.normal_balance }
               : linked && facility ? { number: String(facility.account_code), name: String(facility.name), normal: facility.normal_balance }
               : own || (facility ? { number: String(facility.account_code), name: String(facility.name), normal: facility.normal_balance } : undefined);
          const supplier = code.startsWith('payable:') ? suppliers.find(row => String(row.id) === code.slice(8)) : undefined;
          const customer = code.startsWith('receivable:') ? customers.find(row => Number(row.id) === Number(code.slice(11))) : undefined;
          const collection = destination(code);
          const partyName = supplier?.name || (customer ? `Patient #${customer.patient_id}` : undefined) || collection?.name
               || (code.startsWith('payable:') ? 'Unknown supplier' : code.startsWith('receivable:') ? `Customer account #${code.slice(11)}` : undefined);
          const name = collection && !custom ? String(collection.name)
               : partyName && base ? `${base.name} — ${partyName}` : base?.name || humanize(code);
          const normalBalance = base?.normal === 'credit' ? 'credit' : base?.normal === 'debit' ? 'debit' : null;
          return [code, { number: base?.number || null, name, normalBalance }];
     }));
}