import { Knex } from 'knex';
import { ICommissionTier, CommissionTier } from '../interfaces/CommissionTier.interface';

import { DatabaseError, TierNotFoundError } from '../errors/CommissionErrors';
import KnexConnection from '../../../../database/KnexConnections';
import { ICommissionTierRepository } from '../interfaces/ICommissionTierRepository';

export class CommissionTierRepository implements ICommissionTierRepository {
     constructor(private tenantId: number, private transaction?: Knex | Knex.Transaction) { }

     withTransaction(trx: any): ICommissionTierRepository { return new CommissionTierRepository(this.tenantId, trx); }

     async findById(id: number): Promise<ICommissionTier | null> {
          try {
               const connection = (this.transaction || await KnexConnection(this.tenantId));
               const record = await connection('commission_tiers').where('id', id).first();
               return record ? new CommissionTier(record) : null;
          } catch (error) {
               throw new DatabaseError(`Failed to find commission tier by id ${id}`, error);
          }
     }

     async findByConfigId(configId: number): Promise<ICommissionTier[]> {
          try {
               const connection = (this.transaction || await KnexConnection(this.tenantId));
               const records = await connection('commission_tiers')
                    .where('commission_config_id', configId)
                    .orderBy('sort_order', 'asc');

               return records.map((record) => new CommissionTier(record));
          } catch (error) {
               throw new DatabaseError(`Failed to find tiers for config ${configId}`, error);
          }
     }

     async findMatchingTier(configId: number, amount: number): Promise<ICommissionTier | null> {
          try {
               const connection = (this.transaction || await KnexConnection(this.tenantId));
               const record = await connection('commission_tiers')
                    .where('commission_config_id', configId)
                    .where('min_amount_inclusive', '<=', amount)
                    .where((builder: Knex.QueryBuilder) => {
                         builder.whereNull('max_amount_exclusive').orWhere('max_amount_exclusive', '>', amount);
                    })
                    .orderBy('sort_order', 'asc')
                    .first();
               return record ? new CommissionTier(record) : null;
          } catch (error) {
               throw new DatabaseError(
                    `Failed to find matching tier for config ${configId} with amount ${amount}`,
                    error
               );
          }
     }

     async create(tier: Omit<ICommissionTier, 'id' | 'created_at'>): Promise<ICommissionTier> {
          try {
               const connection = (this.transaction || await KnexConnection(this.tenantId));
               const [id] = await connection('commission_tiers').insert({
                    ...tier,
                    created_at: new Date(),
               });

               const created = await this.findById(id);
               if (!created) {
                    throw new DatabaseError(`Failed to retrieve created commission tier with id ${id}`);
               }
               return created;
          } catch (error) {
               if (error instanceof DatabaseError) throw error;
               throw new DatabaseError('Failed to create commission tier', error);
          }
     }

     async createMultiple(
          tiers: Omit<ICommissionTier, 'id' | 'created_at'>[],
          commission_config_id: number
     ): Promise<ICommissionTier[]> {
          try {
               const connection = (this.transaction || await KnexConnection(this.tenantId));
               const tiersWithTimestamp = tiers.map((tier) => ({
                    ...tier,
                    created_at: new Date(),
                    commission_config_id,
               }));

               const ids = await connection('commission_tiers').insert(tiersWithTimestamp);

               const created = await Promise.all(
                    ids.map((id) => this.findById(id as number).then((t) => t!))
               );

               return created;
          } catch (error) {
               console.log('Error creating multiple commission tiers:', error);
               if (error instanceof DatabaseError) throw error;
               throw new DatabaseError('Failed to create multiple commission tiers', error);
          }
     }

     async delete(id: number): Promise<void> {
          try {
               const connection = (this.transaction || await KnexConnection(this.tenantId));
               await connection('commission_tiers').where('id', id).delete();
          } catch (error) {
               throw new DatabaseError(`Failed to delete commission tier ${id}`, error);
          }
     }

     async deleteByConfigId(configId: number): Promise<void> {
          try {
               const connection = (this.transaction || await KnexConnection(this.tenantId));
               await connection('commission_tiers').where('commission_config_id', configId).delete();
          } catch (error) {
               throw new DatabaseError(`Failed to delete tiers for config ${configId}`, error);
          }
     }
}
