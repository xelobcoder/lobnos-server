import {
     CommissionDefaultRepository,
     DefaultRecipientType,
} from '../repositories/CommissionDefaultRepository';
import { ICommissionDefaultService } from '../interfaces/ICommissionDefaultService';

export class CommissionDefaultService implements ICommissionDefaultService {
     constructor(private tenantId: number) { }

     private get repository(): CommissionDefaultRepository {
          return new CommissionDefaultRepository(this.tenantId);
     }

     async createDefault(input: {
          recipient_type: DefaultRecipientType;
          commission_config_id: number;
          is_active: boolean;
     }) {
          const config = await this.repository.findConfigById(input.commission_config_id);
          if (!config) {
               const error: any = new Error(`Commission configuration with ID ${input.commission_config_id} not found`);
               error.statusCode = 404;
               throw error;
          }

          const existing = await this.repository.findByRecipientType(input.recipient_type);
          if (existing) {
               if (existing.is_active) {
                    const error: any = new Error(
                         `Default commission for ${input.recipient_type} already exists. Only one default per recipient type is allowed.`
                    );
                    error.statusCode = 409;
                    throw error;
               }
               return this.repository.updateById(existing.id, {
                    commission_config_id: input.commission_config_id,
                    is_active: input.is_active,
               });
          }

          return this.repository.create(input);
     }

     async getDefault(recipientType: DefaultRecipientType) {
          const defaults = await this.repository.findActiveByRecipientType(recipientType);
          if (!defaults) return null;
          const config = await this.repository.findConfigById(defaults.commission_config_id);
          return { ...defaults, config };
     }

     async getAllDefaults() {
          const defaults = await this.repository.findAllActive();
          return Promise.all(
               defaults.map(async (def) => {
                    const config = await this.repository.findConfigById(def.commission_config_id);
                    return { ...def, config };
               })
          );
     }

     async getRecipientRoutes(recipientType: DefaultRecipientType, recipientId: number) {
          const assignments = await this.repository.findAssignmentsForRecipient(recipientType, recipientId);

          const assignmentsWithConfig = await Promise.all(
               assignments.map(async (assignment) => {
                    const config = await this.repository.findConfigById(assignment.commission_config_id);
                    return {
                         type: 'assignment',
                         assignment,
                         config,
                    };
               })
          );

          const defaultConfig = await this.repository.findActiveByRecipientType(recipientType);
          let defaultWithConfig: any = null;

          if (defaultConfig) {
               const config = await this.repository.findConfigById(defaultConfig.commission_config_id);
               defaultWithConfig = {
                    type: 'default',
                    default: defaultConfig,
                    config,
               };
          }

          const routes = [
               ...assignmentsWithConfig,
               ...(defaultWithConfig ? [defaultWithConfig] : []),
          ];

          return {
               recipient_type: recipientType,
               recipient_id: recipientId,
               routes,
               total_routes: routes.length,
          };
     }

     async updateDefault(
          defaultId: number,
          updateData: { commission_config_id?: number; is_active?: boolean }
     ) {
          if (updateData.commission_config_id) {
               const config = await this.repository.findConfigById(updateData.commission_config_id);
               if (!config) {
                    const error: any = new Error(
                         `Commission configuration with ID ${updateData.commission_config_id} not found`
                    );
                    error.statusCode = 404;
                    throw error;
               }
          }

          return this.repository.updateById(defaultId, updateData);
     }

     async deactivateDefault(defaultId: number): Promise<void> {
          await this.repository.deactivateById(defaultId);
     }
}
