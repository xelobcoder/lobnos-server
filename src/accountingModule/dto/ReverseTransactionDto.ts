export interface ReverseTransactionDto {
     tenantId: number;
     trx?: any;
     journalEntryId: number;
     description?: string;
     createdBy?: number | null;
}
