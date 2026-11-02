import { Knex } from 'knex';
import { json } from './PharmacyEnterpriseCore';

export async function pharmacyAccountDisplay(db: Knex | Knex.Transaction, branch: number, codes: string[]) {
     const settings = await db('pharmacy_accounting_settings').where({ branchid: branch }).select('mappings').first();
     const mappings = json(settings?.mappings) as Record<string, unknown>;
     const ids = codes.filter(code => code.startsWith('collection:')).map(code => Number(code.slice(11)));
     const destinations = ids.length ? await db('pharmacy_collection_accounts').where({ branchid: branch }).whereIn('id', ids).select('id', 'name', 'account_type') : [];
     const mapped = new Map(codes.map(code => {
          const category = code.startsWith('collection:') ? destinations.find(row => Number(row.id) === Number(code.slice(11)))?.account_type : code === 'supplier_payable' ? 'payable' : code.split(':')[0];
          return [code, mappings[code] || mappings[category]];
     }));
     const sharedCodes = [...new Set([...mapped.values()].filter((code): code is string => typeof code === 'string'))];
     const shared = sharedCodes.length ? await db('acc_accounts').whereIn('account_code', sharedCodes).select('account_code', 'name', 'normal_balance') : [];
     return new Map(codes.map(code => {
          const account = shared.find(row => row.account_code === mapped.get(code));
          return [code, { name: (code.startsWith('collection:') ? destinations.find(row => Number(row.id) === Number(code.slice(11)))?.name : undefined)
               || account?.name || code.replace(/_/g, ' '), normalBalance: account?.normal_balance === 'credit' ? 'credit' : account?.normal_balance === 'debit' ? 'debit' : null }];
     }));
}
