import { AccountType } from '../enums/account-type.enum';
import { NormalBalance } from '../enums/normal-balance.enum';

export interface IAccount {
     id: number;
     account_code: string;
     name: string;
     type: AccountType;
     normal_balance: NormalBalance;
     parent_account_id: number | null;
     is_active: boolean;
     created_at?: Date;
     updated_at?: Date;
}
