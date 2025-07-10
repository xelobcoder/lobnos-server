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

     async findByCode(code: number): Promise<ReferralCoding | null> {
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