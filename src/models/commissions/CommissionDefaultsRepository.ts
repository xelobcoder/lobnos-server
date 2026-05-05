import KnexConnection from "../../database/KnexConnections";

export type CommissionDefaultsType = {
     id?: number;
     target_type: 'GLOBAL' | 'CLINICIAN' | 'ORGANIZATION';
     commission_type: 'PERCENTAGE' | 'FIXED';
     commission_value: number;
     created_on?: string | Date;
     updated_on?: string | Date;
};

export class CommissionDefaultsRepository {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number,trx?:any) {
          this.tenantId = tenantId;
          this.connection = trx ? trx : KnexConnection(tenantId);
     }

     /**
      * Get all commission defaults
      */
     async getAll(): Promise<CommissionDefaultsType[]> {
          const connection = await this.connection;
          return connection('commission_defaults').select('*');
     }

     /**
      * Get commission defaults by target type
      */
     async getByTargetType(targetType: 'GLOBAL' | 'CLINICIAN' | 'ORGANIZATION'): Promise<CommissionDefaultsType | null> {
          const connection = await this.connection;
          return connection('commission_defaults')
               .where({ target_type: targetType })
               .first();
     }

     /**
      * Get commission defaults by ID
      */
     async getById(id: number): Promise<CommissionDefaultsType | null> {
          const connection = await this.connection;
          return connection('commission_defaults')
               .where({ id })
               .first();
     }

     /**
      * Create a new commission default
      */
     async create(data: Omit<CommissionDefaultsType, 'id' | 'created_on' | 'updated_on'>): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection('commission_defaults').insert({
               target_type: data.target_type,
               commission_type: data.commission_type,
               commission_value: data.commission_value,
               created_on: new Date(),
               updated_on: new Date(),
          });
          return id;
     }

     /**
      * Update commission defaults by ID
      */
     async updateById(id: number, data: Partial<Omit<CommissionDefaultsType, 'id' | 'created_on'>>): Promise<boolean> {
          const connection = await this.connection;
          const updated = await connection('commission_defaults')
               .where({ id })
               .update({
                    ...data,
                    updated_on: new Date(),
               });
          return updated > 0;
     }

     /**
      * Update commission defaults by target type
      */
     async updateByTargetType(
          targetType: 'GLOBAL' | 'CLINICIAN' | 'ORGANIZATION',
          data: Partial<Omit<CommissionDefaultsType, 'id' | 'target_type' | 'created_on'>>
     ): Promise<boolean> {
          const connection = await this.connection;
          const updated = await connection('commission_defaults')
               .where({ target_type: targetType })
               .update({
                    ...data,
                    updated_on: new Date(),
               });
          return updated > 0;
     }

     /**
      * Delete commission defaults by ID
      */
     async deleteById(id: number): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);
          const deleted = await connection('commission_defaults')
               .where({ id })
               .del();
          return deleted > 0;
     }

     /**
      * Delete commission defaults by target type
      */
     async deleteByTargetType(targetType: 'GLOBAL' | 'CLINICIAN' | 'ORGANIZATION'): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);
          const deleted = await connection('commission_defaults')
               .where({ target_type: targetType })
               .del();
          return deleted > 0;
     }

     /**
      * Check if a target type exists
      */
     async exists(targetType: 'GLOBAL' | 'CLINICIAN' | 'ORGANIZATION'): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);
          const record = await connection('commission_defaults')
               .where({ target_type: targetType })
               .first();
          return !!record;
     }

     /**
      * Get commission value for a target type
      */
     async getCommissionValue(targetType: 'GLOBAL' | 'CLINICIAN' | 'ORGANIZATION'): Promise<{ value: number; type: 'PERCENTAGE' | 'FIXED' } | null> {
          const connection = await KnexConnection(this.tenantId);
          const record = await connection('commission_defaults')
               .where({ target_type: targetType })
               .select('commission_value', 'commission_type')
               .first();

          if (!record) return null;

          return {
               value: record.commission_value,
               type: record.commission_type,
          };
     }
}
