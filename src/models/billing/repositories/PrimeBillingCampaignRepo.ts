import KnexConnection from "../../../database/KnexConnections";

export interface PrimeBillingCampaign {
     id?: number;
     name: string;
     description?: string | null;
     start_date: Date;
     end_date?: Date | null;
     created_at?: Date;
     updated_at?: Date;
}

export class PrimeBillingCampaignRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Omit<PrimeBillingCampaign, 'id' | 'created_at' | 'updated_at'>): Promise<number|string> {
          try {
               const conn = await this.connection;
               const [id] = await conn('prime_billing_campaigns').insert(data);
               return id;
          } catch (error: any) {
               if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('Duplicate entry'))) {
                    return 'Campaign name must be unique.Duplicate entry found';
               }
               throw error;
          }
     }

     async findById(id: number): Promise<PrimeBillingCampaign | undefined> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_campaigns').where({ id }).first();
          } catch (error) {
               console.error('PrimeBillingCampaign findById error:', error);
               throw error;
          }
     }

     async update(id: number, updates: Partial<Omit<PrimeBillingCampaign, 'id'>>): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_campaigns').where({ id }).update(updates);
          } catch (error) {
               console.error('PrimeBillingCampaign update error:', error);
               throw error;
          }
     }

     async delete(id: number): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_campaigns').where({ id }).delete();
          } catch (error) {
               console.error('PrimeBillingCampaign delete error:', error);
               throw error;
          }
     }

     async list(): Promise<PrimeBillingCampaign[]> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_campaigns').select();
          } catch (error) {
               console.error('PrimeBillingCampaign list error:', error);
               throw error;
          }
     }
}