export class AccountingError extends Error {
     constructor(
          message: string,
          public code: string,
          public statusCode: number = 500
     ) {
          super(message);
          this.name = 'AccountingError';
          Object.setPrototypeOf(this, AccountingError.prototype);
     }
}

export class UnbalancedTransactionError extends AccountingError {
     constructor(totalDebits: number, totalCredits: number) {
          super(
               `Transaction is not balanced: debits ${totalDebits} != credits ${totalCredits}`,
               'UNBALANCED_TRANSACTION',
               400
          );
          Object.setPrototypeOf(this, UnbalancedTransactionError.prototype);
     }
}

export class AccountNotFoundError extends AccountingError {
     constructor(accountCode: string) {
          super(
               `Account ${accountCode} not found`,
               'ACCOUNT_NOT_FOUND',
               404
          );
          Object.setPrototypeOf(this, AccountNotFoundError.prototype);
     }
}

export class JournalEntryNotFoundError extends AccountingError {
     constructor(journalEntryId: number) {
          super(
               `Journal entry ${journalEntryId} not found`,
               'JOURNAL_ENTRY_NOT_FOUND',
               404
          );
          Object.setPrototypeOf(this, JournalEntryNotFoundError.prototype);
     }
}

export class EmptyTransactionError extends AccountingError {
     constructor() {
          super(
               'A transaction requires at least one debit and one credit line',
               'EMPTY_TRANSACTION',
               400
          );
          Object.setPrototypeOf(this, EmptyTransactionError.prototype);
     }
}

export class PeriodClosedError extends AccountingError {
     constructor(periodCode: string, status: string) {
          super(
               `Accounting period ${periodCode} is ${status} and will not accept new postings`,
               'PERIOD_CLOSED',
               409
          );
          Object.setPrototypeOf(this, PeriodClosedError.prototype);
     }
}

export class PeriodNotFoundError extends AccountingError {
     constructor(periodCode: string) {
          super(
               `Accounting period ${periodCode} not found`,
               'PERIOD_NOT_FOUND',
               404
          );
          Object.setPrototypeOf(this, PeriodNotFoundError.prototype);
     }
}
