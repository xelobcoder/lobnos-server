import KnexConnection from "../../database/KnexConnections";

export interface TestDetailCategoryType {
     categoryid?: number;
     categoryname: string;
     testid: number;
     createdby: string;
     updatedby?: string;
     created_at?: Date;
     updated_at?: Date;
     deleted?: boolean;
}

export interface GetAllParams {
     limit?: number;
     offset?: number;
     createdby?: string | null;
}

const TableName = "testdetailcategory";
export class TestDetailCategory {
     static async create(tenantId: number, data: TestDetailCategoryType): Promise<number[]> {
          const connection = await KnexConnection(tenantId);
          return await connection(TableName).insert(data);
     }

     static async getAll(tenantId: number, params: GetAllParams): Promise<TestDetailCategoryType[]> {
          const { limit = 10, offset = 0, createdby = null } = params;
          const connection = await KnexConnection(tenantId);
          let query = connection<TestDetailCategoryType>(TableName)
               .where({ deleted: false })
               .select("*")
               .limit(limit)
               .offset(offset);
          if (createdby) {
               query = query.where({ createdby });
          }
          return await query;
     }

     static async getById(tenantId: number, categoryid: number): Promise<TestDetailCategoryType | undefined> {
          const connection = await KnexConnection(tenantId);
          return await connection<TestDetailCategoryType>(TableName).where({ categoryid, deleted: false }).first();
     }

     static async getByTestId(tenantId: number, testid: number): Promise<TestDetailCategoryType[]> {
          const connection = await KnexConnection(tenantId);
          return await connection<TestDetailCategoryType>(TableName)
               .leftJoin("roles", "roles.employeeid", "=", "testdetailcategory.createdby")
               .where({ testid, deleted: false })
               .select("testdetailcategory.*", "roles.username as createdbyname");
     }

     static async update(tenantId: number, categoryid: number, data: Partial<TestDetailCategoryType>): Promise<number> {
          data.updated_at = new Date();
          const connection = await KnexConnection(tenantId);
          return await connection(TableName).where({ categoryid, deleted: false }).update(data);
     }

     static async softDelete(tenantId: number, categoryid: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection(TableName).where({ categoryid }).update({ deleted: true, updated_at: new Date() });
     }

     static async restore(tenantId: number, categoryid: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection(TableName).where({ categoryid }).update({ deleted: false, updated_at: new Date() });
     }

     static async delete(tenantId: number, categoryid: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection(TableName).where({ categoryid }).del();
     }
}

export default TestDetailCategory;
