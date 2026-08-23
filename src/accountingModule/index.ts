import { AccountingRepository } from './repositories/AccountingRepository';
import { AccountingService } from './services/AccountingService';

export const createAccountingService = (tenantId: number): AccountingService => {
     return new AccountingService(new AccountingRepository(tenantId));
};

export * from './enums/account-type.enum';
export * from './enums/normal-balance.enum';
export * from './enums/journal-status.enum';
export * from './enums/source-module.enum';
export * from './enums/transaction-type.enum';
export * from './dto/PostTransactionDto';
export * from './dto/PostTransactionLineDto';
export * from './dto/ReverseTransactionDto';
export * from './dto/CreateAccountDto';
export * from './dto/LedgerQueryDto';
export * from './errors/AccountingErrors';
export { AccountingService } from './services/AccountingService';
export { AccountingRepository } from './repositories/AccountingRepository';
