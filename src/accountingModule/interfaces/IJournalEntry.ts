import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { JournalStatus } from '../enums/journal-status.enum';

export interface IJournalEntry {
     id: number;
     transaction_type: TransactionType;
     source_module: SourceModule;
     source_table: string;
     source_pk: number;
     description?: string | null;
     occurred_at: Date;
     status: JournalStatus;
     reversal_of_entry_id: number | null;
     created_by: number | null;
     created_at?: Date;
}
