import { SourceModule } from '../enums/source-module.enum';
import { JournalStatus } from '../enums/journal-status.enum';

export interface LedgerQueryDto {
     accountCode?: string;
     sourceModule?: SourceModule;
     status?: JournalStatus;
     from?: string;
     to?: string;
     branchid?: number;
}
