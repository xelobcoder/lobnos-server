import { Knex } from 'knex';
import KnexConnection from '../../../../database/KnexConnections';
import { ICommissionConfig, CommissionConfig, DatabaseError, ConfigNotFoundError } from '../commissionConfigutationRepo';
import { ICommissionConfigRepository } from '../interfaces/ICommissionConfigRepository';



export class CommissionConfigRepository implements ICommissionConfigRepository {
     constructor(private tenantId: number) { }

     async findById(id: number): Promise<ICommissionConfig | null> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const record = await connection('commission_configs')
                    .where('id', id).first();
               return record ? new CommissionConfig(record) : null;
          } catch (error) {
               throw new DatabaseError(`Failed to find commission config by id ${id}`, error);
          }
     }

     async findByName(name: string): Promise<ICommissionConfig | null> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const record = await connection('commission_configs')
                    .where('name', name).first();
               return record ? new CommissionConfig(record) : null;
          } catch (error) {
               throw new DatabaseError(`Failed to find commission config by name ${name}`, error);
          }
     }

     async findActive(onDate: Date): Promise<ICommissionConfig[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const records = await connection('commission_configs')
                    .where('is_active', true)
                    .where('effective_from', '<=', onDate)
                    .where((builder: Knex.QueryBuilder) => {
                         builder.whereNull('effective_to').orWhere('effective_to', '>=', onDate);
                    })
                    .orderBy('effective_from', 'desc');

               return records.map((record) => new CommissionConfig(record));
          } catch (error) {
               throw new DatabaseError('Failed to find active commission configs', error);
          }
     }

     async findAll(): Promise<ICommissionConfig[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const records = await connection('commission_configs').orderBy('created_at', 'desc');
               return records.map((record) => new CommissionConfig(record));
          } catch (error) {
               throw new DatabaseError('Failed to find all commission configs', error);
          }
     }

     async create(
          config: Omit<ICommissionConfig, 'id' | 'created_at' | 'updated_at'>
     ): Promise<ICommissionConfig> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const [id] = await connection('commission_configs').insert({
                    ...config,
                    created_at: new Date(),
                    updated_at: new Date(),
               });

               const created = await this.findById(id);
               if (!created) {
                    throw new DatabaseError(`Failed to retrieve created commission config with id ${id}`);
               }
               return created;
          } catch (error) {
               if (error instanceof DatabaseError) throw error;
               throw new DatabaseError('Failed to create commission config', error);
          }
     }

     async softDelete(id: number): Promise<void> {
          try {
               const connection = await KnexConnection(this.tenantId);
               await connection('commission_configs').where('id', id).update({
                    is_active: false,
                    updated_at: new Date(),
               });
          } catch (error) {
               throw new DatabaseError(`Failed to soft delete commission config ${id}`, error);
          }
     }

     async getByIdOrThrow(id: number): Promise<ICommissionConfig> {
          const config = await this.findById(id);
          if (!config) {
               throw new ConfigNotFoundError(id);
          }
          return config;
     }
}
