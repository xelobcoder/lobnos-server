import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsCategoryMapping {
     id?: number;
     category: 'patient' | 'clinician' | 'organization';
     tablename: string;
     idcolumn: string;
     phonecolumn?: string;
     namecolumn?: string;
     additionalfields?: any;
}

export class PrimeSmsCategoryMappingsRepo {
     private connection;
     private tablename = "primesmscategorymappings";

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: PrimeSmsCategoryMapping): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tablename).insert(data).returning('id');
          return id;
     }

     async findById(id: number): Promise<PrimeSmsCategoryMapping | null> {
          const connection = await this.connection;
          const result = await connection(this.tablename).where({ id }).first();
          return result || null;
     }

     async findAll(): Promise<PrimeSmsCategoryMapping[]> {
          const connection = await this.connection;
          return await connection(this.tablename).select();
     }

     async update(id: number, data: Partial<PrimeSmsCategoryMapping>): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).update(data);
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return await connection(this.tablename).where({ id }).del();
     }

     async getCategoriesWithPlaceholders() {
          try {
               // load columns for organization, clinician, and patient, put in an object format and send back
               const connection = await this.connection;
               const dbSchema = 'limsdb';
               const query = `SELECT CONCAT('{', COLUMN_NAME, '}') AS placeholder FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`;

               const categories = {
                    patient: 'new_patients',
                    clinician: 'clinicianbasicinfo',
                    organization: 'organization'
               };

               const placeholders: Record<string, string[]> = {};
               for (const [category, tableName] of Object.entries(categories)) {
                    const [result] = await connection.raw(query, [dbSchema, tableName]);
                    placeholders[category] = (result || []).map((row: any) => row.placeholder);
               }

               const sensitiveColumns = {
                    patient: ['password', 'refreshToken', 'accessToken'],
               };

               // remove sensitive columns from placeholders
               for (const category in placeholders) {
                    placeholders[category] = placeholders[category].filter((placeholder: string) => {
                         return !sensitiveColumns[category]?.includes(placeholder.replace(/{|}/g, ''));
                    });
               }
               return placeholders;
          } catch (err) {
               console.error('Error loading categories with placeholders:', err);
               throw err;
          }
     }
}
