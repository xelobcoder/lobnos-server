import { AccountType } from '../enums/account-type.enum';
import { NormalBalance } from '../enums/normal-balance.enum';

export interface CreateAccountDto {
     accountCode: string;
     name: string;
     type: AccountType;
     normalBalance: NormalBalance;
     parentAccountId?: number | null;
}
