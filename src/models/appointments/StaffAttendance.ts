import KnexConnection from "../../database/KnexConnections";

class StaffAttendance {
     private tableName: string;

     constructor() {
          this.tableName = "staffattendance";
     }

     async getAll(tenantId: number, filters: Record<string, any> = {}) {
          const connection = await KnexConnection(tenantId);
          const query = connection(this.tableName)
               .join("roles", `${this.tableName}.employeeid`, "roles.employeeid")
               .join("shifts", `${this.tableName}.shiftid`, "shifts.id")
               .select(
                    `${this.tableName}.*`,
                    "roles.username as employee_name",
                    "shifts.name as shift_name",
                    "shifts.time",
                    "shifts.color"
               );

          if (filters.status) query.where(`${this.tableName}.status`, filters.status);
          if (filters.date) query.where(`${this.tableName}.date`, filters.date);
          if (filters.employeeid) query.where(`${this.tableName}.employeeid`, filters.employeeid);
          if (filters.shiftid) query.where(`${this.tableName}.shiftid`, filters.shiftid);
          if (filters.startDate) query.where(`${this.tableName}.date`, ">=", filters.startDate);
          if (filters.endDate) query.where(`${this.tableName}.date`, "<=", filters.endDate);
          if (filters.cycleid) query.where(`${this.tableName}.cycleid`, filters.cycleid);
          if (filters.day) query.where(`${this.tableName}.day`, filters.day);
          if (filters.month) query.where(`${this.tableName}.month`, filters.month);

          return query;
     }

     async getById(tenantId: number, id: number) {
          const connection = await KnexConnection(tenantId);
          return connection(this.tableName)
               .join("roles", `${this.tableName}.employeeid`, "roles.employeeid")
               .join("shifts", `${this.tableName}.shiftid`, "shifts.id")
               .where(`${this.tableName}.id`, id)
               .select(
                    `${this.tableName}.*`,
                    "roles.username as employee_name",
                    "shifts.name as shift_name",
                    "shifts.starttime",
                    "shifts.endtime",
                    "shifts.color"
               )
               .first();
     }

     async create(tenantId: number, attendanceData: { employeeid: number, shiftid: number, date: string, status: string, cycleid: number }[]) {
          const connection = await KnexConnection(tenantId);
          const requiredFields = ["employeeid", "shiftid", "date", "cycleid"];
          for (const item of attendanceData) {
               for (const field of requiredFields) {
                    if (!item[field]) {
                         throw new Error(`Missing required field: ${field}`);
                    }
               }
          }
          const [id] = await connection(this.tableName).insert(attendanceData)
               .onConflict()
               .merge()
               .returning("id");
          return id;
     }

     async update(tenantId: number, id: number, attendanceData: Record<string, any>) {
          const connection = await KnexConnection(tenantId);
          return connection(this.tableName).where({ id }).update(attendanceData);
     }

     async delete(tenantId: number, id: number) {
          const connection = await KnexConnection(tenantId);
          return connection(this.tableName).where({ id }).del();
     }

     async updateStatus(tenantId: number, id: number, status: string) {
          const connection = await KnexConnection(tenantId);
          const validStatuses = ["pending", "scheduled", "completed", "absent"];
          if (!validStatuses.includes(status)) {
               throw new Error(`Invalid status: ${status}. Must be one of ${validStatuses.join(", ")}`);
          }
          return connection(this.tableName).where({ id }).update({ status });
     }

     async bulkCreate(tenantId: number, attendanceRecords: Array<Record<string, any>>) {
          const connection = await KnexConnection(tenantId);
          const requiredFields = ["employeeid", "shiftid", "date", "status", "cycleid"];
          for (const record of attendanceRecords) {
               for (const field of requiredFields) {
                    if (!record[field]) {
                         throw new Error(`Missing required field: ${field} in one of the records`);
                    }
               }
          }
          return connection(this.tableName).insert(attendanceRecords).returning("id");
     }

     async getAttendanceByCycle(tenantId: number, cycleid: number) {
          const connection = await KnexConnection(tenantId);
          return connection(this.tableName)
               .where("cycleid", cycleid)
               .join("roles", `${this.tableName}.employeeid`, "roles.employeeid")
               .join("shifts", `${this.tableName}.shiftid`, "shifts.id")
               .select(
                    `${this.tableName}.*`,
                    "roles.username as employee_name",
                    "shifts.name as shift_name",
                    "shifts.starttime",
                    "shifts.endtime"
               );
     }

     async getAttendanceByEmployee(tenantId: number, employeeId: number, startDate?: string, endDate?: string) {
          const connection = await KnexConnection(tenantId);
          const query = connection(this.tableName)
               .join("shifts", `${this.tableName}.shiftid`, "shifts.id")
               .where(`${this.tableName}.employeeid`, employeeId)
               .select(
                    `${this.tableName}.*`,
                    "shifts.name as shift_name",
                    "shifts.starttime",
                    "shifts.endtime",
                    "shifts.color"
               );

          if (startDate) query.where(`${this.tableName}.date`, ">=", startDate);
          if (endDate) query.where(`${this.tableName}.date`, "<=", endDate);

          return query;
     }

     async countByStatus(tenantId: number, filters: Record<string, any> = {}) {
          const connection = await KnexConnection(tenantId);
          const query = connection(this.tableName)
               .select("status")
               .count("* as count")
               .groupBy("status");

          if (filters.employeeid) query.where("employeeid", filters.employeeid);
          if (filters.startDate) query.where("date", ">=", filters.startDate);
          if (filters.endDate) query.where("date", "<=", filters.endDate);
          if (filters.cycleid) query.where("cycleid", filters.cycleid);

          const results = await query;

          return results.reduce((acc: Record<string, number>, item: any) => {
               acc[item.status] = parseInt(item.count);
               return acc;
          }, {});
     }
}

export default StaffAttendance;
