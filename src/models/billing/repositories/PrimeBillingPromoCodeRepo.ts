import KnexConnection from "../../../database/KnexConnections";

export type DiscountType = 'flat' | 'percentage';

export interface PrimeBillingPromoCode {
     id?: number;
     code: string;
     description?: string | null;
     campaign_id?: number | null;
     discount_type: DiscountType;
     discount_value: number;
     max_uses?: number | null;
     times_used?: number;
     is_active?: boolean;
     valid_from: Date;
     valid_to?: Date | null;
     created_at?: Date;
     updated_at?: Date;
}

export class PrimeBillingPromoCodeRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Omit<PrimeBillingPromoCode, 'id' | 'created_at' | 'updated_at' | 'times_used' | 'is_active'>): Promise<number> {
          try {
               const conn = await this.connection;
               const [id] = await conn('prime_billing_promo_codes').insert(data);
               return id;
          } catch (error) {
               console.error('PrimeBillingPromoCode create error:', error);
               throw error;
          }
     }

     async findById(id: number): Promise<PrimeBillingPromoCode | undefined> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_promo_codes').where({ id }).first();
          } catch (error) {
               console.error('PrimeBillingPromoCode findById error:', error);
               throw error;
          }
     }

     async findByCode(code: string): Promise<PrimeBillingPromoCode | undefined> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_promo_codes').where({ code }).first();
          } catch (error) {
               console.error('PrimeBillingPromoCode findByCode error:', error);
               throw error;
          }
     }

     async update(id: number, updates: Partial<Omit<PrimeBillingPromoCode, 'id'>>): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_promo_codes').where({ id }).update(updates);
          } catch (error) {
               console.error('PrimeBillingPromoCode update error:', error);
               throw error;
          }
     }

     async delete(id: number): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn('prime_billing_promo_codes').where({ id }).delete();
          } catch (error) {
               console.error('PrimeBillingPromoCode delete error:', error);
               throw error;
          }
     }

     async list(campaign_id?: number): Promise<PrimeBillingPromoCode[]> {
          try {
               const conn = await this.connection;
               let query = conn('prime_billing_promo_codes');
               if (campaign_id) {
                    query = query.where({ campaign_id });
               }
               return await query;
          } catch (error) {
               console.error('PrimeBillingPromoCode list error:', error);
               throw error;
          }
     }

     /**
      * Increment the times_used for a promo code by 1.
      */
     async incrementUsage(id: number,trx?:any): Promise<number> {
          try {
               const conn = trx || await this.connection;
               return await conn('prime_billing_promo_codes')
                    .where({ id })
                    .increment('times_used', 1);
          } catch (error) {
               console.error('PrimeBillingPromoCode incrementUsage error:', error);
               throw error;
          }
     }

     /**
      * Update promo code details without affecting times_used.
      */
     async updateDetails(id: number, updates: Partial<Omit<PrimeBillingPromoCode, 'id' | 'times_used'>>): Promise<number> {
          try {
               const conn = await this.connection;
               // Remove times_used if present in updates
               const { times_used, ...rest } = updates as any;
               return await conn('prime_billing_promo_codes').where({ id }).update(rest);
          } catch (error) {
               console.error('PrimeBillingPromoCode updateDetails error:', error);
               throw error;
          }
     }

     /**
      * Validate a promo code: is active, within date, and not exceeded max uses.
      */
     async validatePromoCode(code: string, now: Date = new Date()): Promise<{ valid: boolean, reason?: string, promo?: PrimeBillingPromoCode }> {
          try {
               const conn = await this.connection;
               const promo = await conn('prime_billing_promo_codes').where({ code }).first();
               if (!promo) return { valid: false, reason: 'Promo code not found' };
               if (!promo.is_active) return { valid: false, reason: 'Promo code is not active' };
               if (promo.valid_from && new Date(promo.valid_from) > now) return { valid: false, reason: 'Promo code not yet valid' };
               if (promo.valid_to && new Date(promo.valid_to) < now) return { valid: false, reason: 'Promo code expired' };
               if (promo.max_uses !== null && promo.max_uses !== undefined && promo.times_used >= promo.max_uses) {
                    return { valid: false, reason: 'Promo code usage limit reached' };
               }
               return { valid: true, promo };
          } catch (error) {
               console.error('PrimeBillingPromoCode validatePromoCode error:', error);
               throw error;
          }
     }
}