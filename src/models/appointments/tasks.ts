import { PrimeLimsTabletasks } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";


class PrimeLimsTabletasksService {
     private tableName: string;

     constructor(tableName: string) {
          this.tableName = tableName;
     }

     async create(tenantId: number, task: Partial<PrimeLimsTabletasks>): Promise<number> {
          const connection = await KnexConnection(tenantId)
          const createdPrimeLimsTabletasks = await connection(this.tableName).insert(task)
          return createdPrimeLimsTabletasks[0]
     }
     async read(tenantId: number, id: number): Promise<PrimeLimsTabletasks | undefined> {
          const connection = await KnexConnection(tenantId)
          return await connection(this.tableName)
               .innerJoin("roles", "roles.employeeid", "=", `${this.tableName}.assignedTo`)
               .select(`${this.tableName}.*`, "roles.username")
               .where({ id })
               .first();
     }



     async update(tenantId: number, id: number, updates: Partial<PrimeLimsTabletasks>): Promise<number | undefined> {
          const connection = await KnexConnection(tenantId)
          const updatedPrimeLimsTabletasks = await connection(this.tableName).where({ id }).update(updates)
          return updatedPrimeLimsTabletasks;
     }

     async delete(tenantId: number, id: number): Promise<number> {
          const connection = await KnexConnection(tenantId)
          return await connection(this.tableName).where({ id }).del();
     }

     async list(tenantId: number, page: number, count: number, sortby: 'DESC' | 'ASC'): Promise<PrimeLimsTabletasks[]> {
          const offset = (page - 1) * count;
          const connection = await KnexConnection(tenantId)
          return await connection(this.tableName)
               .innerJoin("roles", "roles.employeeid", "=", `${this.tableName}.assignedTo`)
               .select(`${this.tableName}.*`, "roles.username")
               .orderBy(`${this.tableName}.id`, sortby)
               .limit(count)
               .offset(offset);
     }

}

export default PrimeLimsTabletasksService;