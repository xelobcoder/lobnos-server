import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { PostTransactionLineDto } from './PostTransactionLineDto';

export interface PostTransactionDto {
     tenantId: number;
     trx?: any;
     transactionType: TransactionType;
     sourceModule: SourceModule;
     sourceTable: string;
     sourcePk: number;
     description?: string;
     occurredAt?: Date | string;
     createdBy?: number | null;
     reversalOfEntryId?: number | null;
     lines: PostTransactionLineDto[];
}
