export interface AccountConfig {
     [accountId: string]: {
          name: string;
          type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'dividends';
          normalBalance: 'debit' | 'credit';
     };
}

export const ACCOUNT_CONFIG: AccountConfig = {
     'acc-1000': {
          name: 'Cash',
          type: 'asset',
          normalBalance: 'debit'
     },
     'acc-1001': {
          name: 'Bank Account',
          type: 'asset',
          normalBalance: 'debit'
     },
     'acc-1002': {
          name: 'Accounts Receivable',
          type: 'asset',
          normalBalance: 'debit'
     },
     'acc-1003': {
          name: 'Inventory',
          type: 'asset',
          normalBalance: 'debit'
     },
     'acc-2000': {
          name: 'Accounts Payable',
          type: 'liability',
          normalBalance: 'credit'
     },
     'acc-2001': {
          name: 'Loans Payable',
          type: 'liability',
          normalBalance: 'credit'
     },
     'acc-3000': {
          name: 'Owner\'s Equity',
          type: 'equity',
          normalBalance: 'credit'
     },
     'acc-3001': {
          name: 'Retained Earnings',
          type: 'equity',
          normalBalance: 'credit'
     },
     'acc-4000': {
          name: 'Service Revenue',
          type: 'revenue',
          normalBalance: 'credit'
     },
     'acc-4001': {
          name: 'Product Sales',
          type: 'revenue',
          normalBalance: 'credit'
     },
     'acc-5000': {
          name: 'Cost of Goods Sold',
          type: 'expense',
          normalBalance: 'debit'
     },
     'acc-5001': {
          name: 'Operating Expenses',
          type: 'expense',
          normalBalance: 'debit'
     },
     'acc-5002': {
          name: 'Salaries Expense',
          type: 'expense',
          normalBalance: 'debit'
     },
     'acc-5003': {
          name: 'Rent Expense',
          type: 'expense',
          normalBalance: 'debit'
     },
     'acc-5004': {
          name: 'Utilities Expense',
          type: 'expense',
          normalBalance: 'debit'
     },
     'acc-5005': {
          name: 'Commission Expense',
          type: 'expense',
          normalBalance: 'debit'
     },
     'acc-5006': {
          name: 'Inventory Wastage Expense',
          type: 'expense',
          normalBalance: 'debit'
     }
};

export function getAccountName(accountId: string): string {
     return ACCOUNT_CONFIG[accountId]?.name || accountId;
}

export function getAccountInfo(accountId: string) {
     return ACCOUNT_CONFIG[accountId] || null;
}