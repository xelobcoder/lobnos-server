import { DefaultRecipientType, CommissionDefaultRow, CommissionDefaultConfigRow } from '../repositories/CommissionDefaultRepository';

export interface ICommissionDefaultRepository {
     findConfigById(configId: number): Promise<any | null>;
     findById(id: number): Promise<CommissionDefaultRow | null>;
     findActiveByRecipientType(recipientType: DefaultRecipientType): Promise<CommissionDefaultRow | null>;
     findActiveConfigByRecipientType(recipientType: DefaultRecipientType): Promise<CommissionDefaultConfigRow | null>;
     findAllActive(): Promise<CommissionDefaultRow[]>;
     /** recipient_type is unique regardless of is_active, so callers must check for any existing row (active or not) before inserting */
     findByRecipientType(recipientType: DefaultRecipientType): Promise<CommissionDefaultRow | null>;
     create(input: {
          recipient_type: DefaultRecipientType;
          commission_config_id: number;
          is_active: boolean;
     }): Promise<CommissionDefaultRow | null>;
     updateById(
          id: number,
          updateData: { commission_config_id?: number; is_active?: boolean }
     ): Promise<CommissionDefaultRow | null>;
     deactivateById(id: number): Promise<void>;
     findAssignmentsForRecipient(
          recipientType: DefaultRecipientType,
          recipientId: number
     ): Promise<any[]>;
}
