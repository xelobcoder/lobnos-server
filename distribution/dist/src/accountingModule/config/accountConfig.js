"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountInfo = exports.getAccountName = exports.ACCOUNT_CONFIG = void 0;
exports.ACCOUNT_CONFIG = {
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
    }
};
function getAccountName(accountId) {
    var _a;
    return ((_a = exports.ACCOUNT_CONFIG[accountId]) === null || _a === void 0 ? void 0 : _a.name) || accountId;
}
exports.getAccountName = getAccountName;
function getAccountInfo(accountId) {
    return exports.ACCOUNT_CONFIG[accountId] || null;
}
exports.getAccountInfo = getAccountInfo;
