import { DefaultRecipientType } from '../repositories/CommissionDefaultRepository';

export interface ICommissionDefaultService {
     /**
      * recipient_type is unique in commission_default, so if a deactivated row already exists
      * for the type it is reactivated/updated in place instead of inserting a new row.
      */
     createDefault(input: {
          recipient_type: DefaultRecipientType;
          commission_config_id: number;
          is_active: boolean;
     }): Promise<any>;
     getDefault(recipientType: DefaultRecipientType): Promise<any | null>;
     getAllDefaults(): Promise<any[]>;
     getRecipientRoutes(recipientType: DefaultRecipientType, recipientId: number): Promise<any>;
     updateDefault(
          defaultId: number,
          updateData: { commission_config_id?: number; is_active?: boolean }
     ): Promise<any>;
     deactivateDefault(defaultId: number): Promise<void>;
}
