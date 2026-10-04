
import KnexConnection from "../../../database/KnexConnections";

export type EntityType = 'organization' | 'clinician' | 'insurance';

export interface ReferralCoding {
     id?: number;
     entity_id: number;
     entity_type: EntityType;
     code: number;
}

export class ReferralCodingRepo {
     private tenantId: number;
     private connection: any;


     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async generateCode(entity_type: EntityType): Promise<string> {
          try {
               const conn = await this.connection;
               const existingCodes = await conn('referralcoding')
                    .where({ entity_type })
                    .select('code');

               let prefix = 'A';
               if (entity_type === 'insurance') prefix = 'I';
               else if (entity_type === 'clinician') prefix = 'C';
               else if (entity_type === 'organization') prefix = 'O';

               let maxNum = 0;
               for (const row of existingCodes) {
                    const match = new RegExp(`^${prefix}(\\d{3})$`).exec(row.code);
                    if (match) {
                         const num = parseInt(match[1], 10);
                         if (num > maxNum) maxNum = num;
                    }
               }

               const nextNum = maxNum + 1;
               const code = `${prefix}${nextNum.toString().padStart(3, '0')}`;
               return code;
          } catch (error) {
               console.error('ReferralCoding generateCode error:', error);
               throw error;
          }
     }


     async getReferralStrategyFullList(limit: number = 20, offset: number = 0): Promise<any[]> {
          try {
               const conn = await this.connection;
               const results = await conn('referralcoding as r')
                    .select(
                         'r.id as referral_id',
                         'r.entity_type as referral_type',
                         'r.code as referral_code',
                         conn.raw('COALESCE(o.name, c.name) as name'),
                         conn.raw('COALESCE(o.location, c.location) as location'),
                         conn.raw('COALESCE(o.email, c.email) as email')
                    )
                    .leftJoin('organization as o', function (this: any) {
                         this.on('r.entity_type', '=', conn.raw("'organization'"))
                              .andOn('r.entity_id', '=', 'o.id');
                    })
                    .leftJoin('clinicianbasicinfo as c', function (this: any) {
                         this.on('r.entity_type', '=', conn.raw("'clinician'"))
                              .andOn('r.entity_id', '=', 'c.id');
                    })
                    .limit(limit)
                    .offset(offset);
               return results;
          } catch (error) {
               console.error('ReferralCodingRepo.getReferralStrategyFullList error:', error);
               throw error;
          }
     }

     async getManagementPage(params: {
          page: number;
          count: number;
          search?: string;
          entityType?: 'organization' | 'clinician';
     }): Promise<{ items: any[]; total: number; page: number; count: number }> {
          const conn = await this.connection;
          const buildQuery = () => {
               let query = conn('referralcoding as r')
                    .leftJoin('organization as o', function (this: any) {
                         this.on('r.entity_type', '=', conn.raw("'organization'"))
                              .andOn('r.entity_id', '=', 'o.id');
                    })
                    .leftJoin('clinicianbasicinfo as c', function (this: any) {
                         this.on('r.entity_type', '=', conn.raw("'clinician'"))
                              .andOn('r.entity_id', '=', 'c.id');
                    })
                    .whereIn('r.entity_type', ['organization', 'clinician']);

               if (params.entityType) query = query.where('r.entity_type', params.entityType);
               if (params.search) {
                    const search = `%${params.search}%`;
                    query = query.where((builder: any) => {
                         builder
                              .where('r.code', 'like', search)
                              .orWhereRaw('COALESCE(o.name, c.name) LIKE ?', [search])
                              .orWhereRaw('COALESCE(o.email, c.email) LIKE ?', [search]);
                    });
               }

               return query;
          };

          const countResult = await buildQuery().countDistinct({ total: 'r.id' }).first();
          const items = await buildQuery()
               .select(
                    'r.id as referral_id',
                    'r.entity_id',
                    'r.entity_type as referral_type',
                    'r.code as referral_code',
                    conn.raw('COALESCE(o.name, c.name) as name'),
                    conn.raw('COALESCE(o.location, c.location) as location'),
                    conn.raw('COALESCE(o.email, c.email) as email')
               )
               .orderBy('r.entity_type', 'asc')
               .orderBy('name', 'asc')
               .limit(params.count)
               .offset((params.page - 1) * params.count);

          return {
               items,
               total: Number(countResult?.total || 0),
               page: params.page,
               count: params.count,
          };
     }


     async getEnityInformation(entity_type: EntityType, entity_id: number): Promise<any> {
          try {
               const conn = await this.connection;
               let result;
               if (entity_type === 'organization') {
                    result = await conn('organization').where({ id: entity_id }).first();
               } else if (entity_type === 'clinician') {
                    result = await conn('clinicianbasicinfo').where({ id: entity_id }).first();
               } else if (entity_type === "insurance") {
                    throw new Error('Unsupported entity type');
               }
               return result;
          } catch (error) {
               console.error('ReferralCoding getEntityInformation error:', error);
               throw error;
          }
     }

     async create(data: Omit<ReferralCoding, 'id'>, trx?: any): Promise<number> {
          try {
               const conn = trx || await this.connection;
               const code = await this.generateCode(data.entity_type);
               const insertData = { ...data, code };
               const [id] = await conn('referralcoding').insert(insertData);
               return id;
          } catch (error) {
               console.error('ReferralCoding create error:', error);
               throw error;
          }
     }

     async findById(id: number): Promise<ReferralCoding | undefined> {
          try {
               const conn = await this.connection;
               return await conn('referralcoding').where({ id }).first();
          } catch (error) {
               console.error('ReferralCoding findById error:', error);
               throw error;
          }
     }

     async findByEntity(entity_id: number, entity_type: EntityType): Promise<ReferralCoding[]> {
          try {
               const conn = await this.connection;
               return await conn('referralcoding').where({ entity_id, entity_type });
          } catch (error) {
               console.error('ReferralCoding findByEntity error:', error);
               throw error;
          }
     }

     async findByCode(code: string): Promise<ReferralCoding | null> {
          try {
               const conn = await this.connection;
               const result = await conn('referralcoding').where({ code });
               return result.length > 0 ? result[0] : null;
          } catch (error) {
               console.error('ReferralCoding findByCode error:', error);
               throw error;
          }
     }

     async update(id: number, updates: Partial<Omit<ReferralCoding, 'id'>>): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn('referralcoding').where({ id }).update(updates);
          } catch (error) {
               console.error('ReferralCoding update error:', error);
               throw error;
          }
     }

     async delete(id: number): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn('referralcoding').where({ id }).delete();
          } catch (error) {
               console.error('ReferralCoding delete error:', error);
               throw error;
          }
     }

     async list(entity_type?: EntityType): Promise<ReferralCoding[]> {
          try {
               const conn = await this.connection;
               let query = conn('referralcoding');
               if (entity_type) {
                    query = query.where({ entity_type });
               }
               return await query;
          } catch (error) {
               console.error('ReferralCoding list error:', error);
               throw error;
          }
     }
}