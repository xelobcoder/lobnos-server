import KnexConnection from '../../../../database/KnexConnections';
import { Knex } from 'knex';
import { ICommissionDefaultRepository } from '../interfaces/ICommissionDefaultRepository';

export type DefaultRecipientType = 'clinician' | 'organization';

export interface CommissionDefaultRow {
     id: number;
     recipient_type: DefaultRecipientType;
     commission_config_id: number;
     is_active: boolean;
     created_at?: Date;
}

export interface CommissionAssignmentRow {
     id: number;
     commission_config_id: number;
     scope_type: string;
     scope_id?: number;
     priority: number;
     assigned_from: Date;
     assigned_to?: Date | null;
     is_active: boolean;
}

export interface CommissionDefaultConfigRow extends CommissionDefaultRow {
     commission_type: string;
     percentage_rate: number | string | null;
}

export class CommissionDefaultRepository implements ICommissionDefaultRepository {
     constructor(private tenantId: number, private transaction?: Knex | Knex.Transaction) { }

     private async connection() {
          return this.transaction || KnexConnection(this.tenantId);
     }

     async findConfigById(configId: number): Promise<any | null> {
          const conn = await this.connection();
          return conn('commission_configs').where({ id: configId }).first();
     }

     async findById(id: number): Promise<CommissionDefaultRow | null> {
          const conn = await this.connection();
          const row = await conn('commission_default').where({ id }).first();
          return row || null;
     }

     async findActiveByRecipientType(recipientType: DefaultRecipientType): Promise<CommissionDefaultRow | null> {
          const conn = await this.connection();
          const row = await conn('commission_default')
               .where({ recipient_type: recipientType, is_active: true })
               .orderBy('id', 'desc')
               .first();
          return row || null;
     }

     async findActiveConfigByRecipientType(
          recipientType: DefaultRecipientType
     ): Promise<CommissionDefaultConfigRow | null> {
          const conn = await this.connection();
          const row = await conn('commission_default as defaults')
               .join('commission_configs as configs', 'configs.id', 'defaults.commission_config_id')
               .where({
                    'defaults.recipient_type': recipientType,
                    'defaults.is_active': true,
                    'configs.is_active': true,
               })
               .orderBy('defaults.id', 'desc')
               .select(
                    'defaults.*',
                    'configs.commission_type',
                    'configs.percentage_rate'
               )
               .first();
          return row || null;
     }

     async findAllActive(): Promise<CommissionDefaultRow[]> {
          const conn = await this.connection();
          return conn('commission_default').where({ is_active: true }).select('*');
     }

     async findByRecipientType(recipientType: DefaultRecipientType): Promise<CommissionDefaultRow | null> {
          const conn = await this.connection();
          const row = await conn('commission_default')
               .where({ recipient_type: recipientType })
               .orderBy('id', 'desc')
               .first();
          return row || null;
     }

     async create(input: {
          recipient_type: DefaultRecipientType;
          commission_config_id: number;
          is_active: boolean;
     }): Promise<CommissionDefaultRow | null> {
          const conn = await this.connection();
          const [id] = await conn('commission_default').insert({
               recipient_type: input.recipient_type,
               commission_config_id: input.commission_config_id,
               is_active: input.is_active,
               created_at: new Date(),
          });
          return this.findById(Number(id));
     }

     async updateById(
          id: number,
          updateData: { commission_config_id?: number; is_active?: boolean }
     ): Promise<CommissionDefaultRow | null> {
          const conn = await this.connection();
          await conn('commission_default').where({ id }).update(updateData);
          return this.findById(id);
     }

     async deactivateById(id: number): Promise<void> {
          const conn = await this.connection();
          await conn('commission_default').where({ id }).update({ is_active: false });
     }

     async findAssignmentsForRecipient(
          recipientType: DefaultRecipientType,
          recipientId: number
     ): Promise<CommissionAssignmentRow[]> {
          const conn = await this.connection();
          return conn('commission_assignments')
               .where('scope_type', recipientType)
               .where('scope_id', recipientId)
               .orderBy('priority', 'desc')
               .orderBy('assigned_from', 'desc');
     }
}
