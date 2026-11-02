import { NormalBalance } from '../enums/normal-balance.enum';

export interface PostTransactionLineDto {
     accountCode: string;
     direction: NormalBalance;
     amount: number;
     branchid?: number | null;
     billingid?: number | null;
     expenseId?: number | null;
     invoiceId?: number | null;
     employeeid?: number | null;
     partyType?: string;
     partyRef?: string;
     partyName?: string;
     documentRef?: string;
}
