export interface DefaultPharmacyAccount {
     account_code: string;
     account_number: string;
     name: string;
     type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
     normal_balance: 'debit' | 'credit';
}

// account_code is the internal posting key; account_number and name are what accountants see.
export const DEFAULT_PHARMACY_ACCOUNTS: DefaultPharmacyAccount[] = [
     { account_code: 'interbranch_receivable', account_number: '1150', name: 'Inter-branch receivable', type: 'asset', normal_balance: 'debit' },
     { account_code: 'supplier_returns_pending', account_number: '1160', name: 'Purchase returns receivable', type: 'asset', normal_balance: 'debit' },
     { account_code: 'inventory', account_number: '1200', name: 'Inventory', type: 'asset', normal_balance: 'debit' },
     { account_code: 'quarantine_inventory', account_number: '1210', name: 'Quarantined inventory', type: 'asset', normal_balance: 'debit' },
     { account_code: 'stock_in_transit', account_number: '1220', name: 'Stock in transit', type: 'asset', normal_balance: 'debit' },
     { account_code: 'inventory_in_transit', account_number: '1230', name: 'Inventory in transit', type: 'asset', normal_balance: 'debit' },
     { account_code: 'asset:input_tax', account_number: '1300', name: 'Input tax recoverable', type: 'asset', normal_balance: 'debit' },
     { account_code: 'liability:grni', account_number: '2050', name: 'Goods received not invoiced (GRNI)', type: 'liability', normal_balance: 'credit' },
     { account_code: 'liability:output_tax', account_number: '2100', name: 'Output tax payable', type: 'liability', normal_balance: 'credit' },
     { account_code: 'interbranch_payable', account_number: '2150', name: 'Inter-branch payable', type: 'liability', normal_balance: 'credit' },
     { account_code: 'opening_equity', account_number: '3000', name: 'Opening balance equity', type: 'equity', normal_balance: 'credit' },
     { account_code: 'sales', account_number: '4000', name: 'Sales revenue', type: 'revenue', normal_balance: 'credit' },
     { account_code: 'sales_returns', account_number: '4010', name: 'Sales returns and allowances', type: 'revenue', normal_balance: 'debit' },
     { account_code: 'sales_discounts', account_number: '4020', name: 'Sales discounts', type: 'revenue', normal_balance: 'debit' },
     { account_code: 'revenue:credits', account_number: '4030', name: 'Sales credit notes', type: 'revenue', normal_balance: 'debit' },
     { account_code: 'cost_of_sales', account_number: '5000', name: 'Cost of goods sold', type: 'expense', normal_balance: 'debit' },
     { account_code: 'inventory_adjustments', account_number: '5100', name: 'Inventory adjustments and write-offs', type: 'expense', normal_balance: 'debit' },
     { account_code: 'operating_expenses', account_number: '6000', name: 'Operating expenses', type: 'expense', normal_balance: 'debit' },
     { account_code: 'expense:bad_debt', account_number: '6100', name: 'Bad debt expense', type: 'expense', normal_balance: 'debit' },
];

// Control accounts for subsidiary ledgers and report-only lines that are not standalone chart entries.
export const PHARMACY_CONTROL_ACCOUNTS: Record<string, { account_number: string; name: string; normal_balance: 'debit' | 'credit' }> = {
     'collection:cash': { account_number: '1000', name: 'Cash on hand', normal_balance: 'debit' },
     'collection:bank': { account_number: '1010', name: 'Cash at bank', normal_balance: 'debit' },
     'collection:mobile_money': { account_number: '1020', name: 'Mobile money', normal_balance: 'debit' },
     receivable: { account_number: '1100', name: 'Accounts receivable', normal_balance: 'debit' },
     payable: { account_number: '2000', name: 'Accounts payable', normal_balance: 'credit' },
     supplier_payable: { account_number: '2000', name: 'Accounts payable', normal_balance: 'credit' },
     retained_result: { account_number: '3100', name: 'Retained earnings', normal_balance: 'credit' },
     'revenue:other': { account_number: '4900', name: 'Other income', normal_balance: 'credit' },
     'expense:other': { account_number: '6900', name: 'Other expenses', normal_balance: 'debit' },
};

export const RESERVED_PHARMACY_ACCOUNT_NUMBERS = new Set([
     ...DEFAULT_PHARMACY_ACCOUNTS.map(account => account.account_number),
     ...Object.values(PHARMACY_CONTROL_ACCOUNTS).map(account => account.account_number),
]);
