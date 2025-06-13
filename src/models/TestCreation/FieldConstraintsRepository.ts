import KnexConnection from "../../database/KnexConnections";

class FieldConstraintsRepository {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async create(constraints: FieldConstraint[]): Promise<number[]> {
          try {
               const conn = await this.connection;
               const result = await conn('field_constraints')
                    .insert(constraints)
                    .onConflict(['testid', 'fieldid', 'constraint_type', 'value', 'action'])
                    .merge()
                    .returning('id');

               return result.map(r => r.id);
          } catch (error) {
               console.error('Field constraints creation error:', error);
               throw error;
          }
     }

     async findByFieldId(fieldId: number): Promise<FieldConstraint[]> {
          try {
               const conn = await this.connection;
               return await conn('field_constraints').where('fieldid', fieldId);
          } catch (error) {
               console.error('Field constraints find error:', error);
               throw error;
          }
     }

     async findByTestId(testId: number): Promise<FieldConstraint[]> {
          try {
               const conn = await this.connection;
               return await conn('field_constraints').where('testid', testId);
          } catch (error) {
               console.error('Field constraints find by test error:', error);
               throw error;
          }
     }

     async update(id: number, updates: Partial<FieldConstraint>): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('field_constraints')
                    .where('id', id)
                    .update(updates);
               return result > 0;
          } catch (error) {
               console.error('Field constraints update error:', error);
               throw error;
          }
     }

     async delete(id: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('field_constraints')
                    .where('id', id)
                    .delete();
               return result > 0;
          } catch (error) {
               console.error('Field constraints delete error:', error);
               throw error;
          }
     }

     async deleteByFieldId(fieldId: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('field_constraints')
                    .where('fieldid', fieldId)
                    .delete();
               return result > 0;
          } catch (error) {
               console.error('Field constraints delete by field error:', error);
               throw error;
          }
     }

     async deleteByTestId(testId: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('field_constraints')
                    .where('testid', testId)
                    .delete();
               return result > 0;
          } catch (error) {
               console.error('Field constraints delete by test error:', error);
               throw error;
          }
     }
}

export default FieldConstraintsRepository;