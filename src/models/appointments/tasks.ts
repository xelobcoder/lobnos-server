import { PrimeLimsTabletasks } from "../../interfaces/database";
import KnexConnection from "../../database/KnexConnections";


class PrimeLimsTabletasksService {
     private tableName: string;

     constructor(tableName: string) {
          this.tableName = tableName;
     }

     private padDateTimePart(value: number): string {
          return value.toString().padStart(2, "0");
     }

     private formatDateTimeForMysql(value: Date | string): string {
          if (typeof value === "string") {
               const trimmed = value.trim();
               const isoLikeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$/);
               if (isoLikeMatch) {
                    const [, datePart, timePart, secondsPart] = isoLikeMatch;
                    return `${datePart} ${timePart}:${secondsPart || "00"}`;
               }
          }

          const parsed = value instanceof Date ? value : new Date(value);
          if (Number.isNaN(parsed.getTime())) {
               throw new Error("Invalid task datetime format");
          }

          const year = parsed.getFullYear();
          const month = this.padDateTimePart(parsed.getMonth() + 1);
          const day = this.padDateTimePart(parsed.getDate());
          const hours = this.padDateTimePart(parsed.getHours());
          const minutes = this.padDateTimePart(parsed.getMinutes());
          const seconds = this.padDateTimePart(parsed.getSeconds());

          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
     }

     private normalizeTaskDateFields(task: Partial<PrimeLimsTabletasks>): Partial<PrimeLimsTabletasks> {
          const normalizedTask = { ...task };

          if (normalizedTask.startDate !== undefined && normalizedTask.startDate !== null) {
               normalizedTask.startDate = this.formatDateTimeForMysql(normalizedTask.startDate);
          }

          if (normalizedTask.endDate !== undefined && normalizedTask.endDate !== null) {
               normalizedTask.endDate = this.formatDateTimeForMysql(normalizedTask.endDate);
          }

          return normalizedTask;
     }

     async create(tenantId: number, task: Partial<PrimeLimsTabletasks>): Promise<number> {
          const connection = await KnexConnection(tenantId)
          const normalizedTask = this.normalizeTaskDateFields(task);
          const createdPrimeLimsTabletasks = await connection(this.tableName).insert(normalizedTask)
          console.log("Created task with ID:", createdPrimeLimsTabletasks);
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
          const normalizedUpdates = this.normalizeTaskDateFields(updates);
          const updatedPrimeLimsTabletasks = await connection(this.tableName).where({ id }).update(normalizedUpdates)
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
               .leftJoin("roles", "roles.employeeid", "=", `${this.tableName}.assignedTo`)
               .select(`${this.tableName}.*`, "roles.username")
               .orderBy(`${this.tableName}.id`, sortby)
               .limit(count)
               .offset(offset);
     }

}

export default PrimeLimsTabletasksService;