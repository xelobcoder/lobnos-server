import KnexConnection from "../../../database/KnexConnections";
import { FieldConstraintEntity } from "../entities/FieldConstraints.entity";
import zod from "zod";

class FieldConstraintsRepository {
     private tenantId: number;
     private connection: any;
     private tablename: string;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
          this.tablename = 'field_constraints'
     }

     validateFieldContraintsDataForCreation(constraints: FieldConstraintEntity[]): boolean {
          const constraintSchema = zod.object({
               testid: zod.number().int().positive(),
               fieldid: zod.number().int().positive(),
               action: zod.enum(["none", "alert", "ignore", "replace", "lock-result"]),
               constraint_type: zod.enum(["null", "less", "greater", "match", "notmatch", "between", "contains"]),
               replacement_text: zod.string().optional().nullable(),
               value: zod.string().max(255).optional(),
               prefix: zod.string().max(255).optional(),
               suffix: zod.string().max(255).optional(),
          });
          return zod.array(constraintSchema).safeParse(constraints).success;
     }


     async create(constraints: FieldConstraintEntity[]): Promise<number[]> {
          try {
               const validationResult = this.validateFieldContraintsDataForCreation(constraints);
               if (!validationResult) {
                    throw new Error("Invalid field constraints data");
               }
               const conn = await this.connection;
               const result = await conn(this.tablename)
                    .insert(constraints)
                    .onConflict(['testid', 'fieldid', 'constraint_type', 'value', 'action'])
                    .merge()
                    .returning('id');

               return result.map((row: any) => row.id);
          } catch (error) {
               throw error;
          }
     }

     async findByFieldId(fieldId: number): Promise<FieldConstraintEntity[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tablename).where('fieldid', fieldId);
          } catch (error) {
               throw error;
          }
     }

     async findByTestId(testId: number): Promise<FieldConstraintEntity[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tablename).where('testid', testId);
          } catch (error) {
               throw error;
          }
     }

     async update(id: number, updates: Partial<FieldConstraintEntity>): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn(this.tablename)
                    .where('id', id)
                    .update(updates);
               return result > 0;
          } catch (error) {
               throw error;
          }
     }

     async delete(id: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn(this.tablename)
                    .where('id', id)
                    .delete();
               return result > 0;
          } catch (error) {
               throw error;
          }
     }

     async deleteByFieldId(fieldId: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn(this.tablename)
                    .where('fieldid', fieldId)
                    .delete();
               return result > 0;
          } catch (error) {
               throw error;
          }
     }

     async deleteByTestId(testId: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn(this.tablename)
                    .where('testid', testId)
                    .delete();
               return result > 0;
          } catch (error) {
               throw error;
          }
     }
}

export default FieldConstraintsRepository;