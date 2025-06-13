import { promisifyQuery } from "../../hooks/helper";

interface EmployeePreferredShift {
     employeeid: number;
     shiftid: number | number[];
}

interface EmployeeUnavailableDay {
     employeeid: number;
     dayofweek: string | string[];
}

class EmployeeShiftService {
     static async createPreferredShift(record: EmployeePreferredShift, tenantId: number): Promise<EmployeePreferredShift[]> {
          try {
               const shiftIds = Array.isArray(record.shiftid) ? record.shiftid : [record.shiftid];
               const insertedRecords: EmployeePreferredShift[] = [];

               for (const shiftid of shiftIds) {
                    await promisifyQuery(
                         tenantId,
                         `INSERT INTO employeepreferredshifts (employeeid, shiftid)
                     VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE shiftid = VALUES(shiftid)`,
                         [record.employeeid, shiftid]
                    );

                    insertedRecords.push({ employeeid: record.employeeid, shiftid });
               }

               return insertedRecords;
          } catch (err) {
               console.error("Error inserting preferred shifts:", err);
               throw err;
          }
     }

     static async getAllPreferredShifts(tenantId: number): Promise<EmployeePreferredShift[]> {
          const result = await promisifyQuery(tenantId, "SELECT * FROM employeepreferredshifts");
          return result;
     }

     static async getPreferredShift(employeeid: number, tenantId: number): Promise<EmployeePreferredShift[]> {
          const result = await promisifyQuery(
               tenantId,
               `SELECT * FROM employeepreferredshifts
             JOIN shifts ON shifts.id = employeepreferredshifts.shiftid
             WHERE employeeid = ?`,
               [employeeid]
          );
          return result;
     }

     static async deletePreferredShift(employeeid: number, shiftid: number, tenantId: number): Promise<number> {
          const result = await promisifyQuery(
               tenantId,
               `DELETE FROM employeepreferredshifts
             WHERE employeeid = ? AND shiftid = ?`,
               [employeeid, shiftid]
          );
          return result.affectedRows;
     }

     static async createUnavailableDay(record: EmployeeUnavailableDay, tenantId: number): Promise<EmployeeUnavailableDay> {
          let dayStr: string;
          if (Array.isArray(record.dayofweek)) {
               dayStr = record.dayofweek.join(",");
          } else {
               dayStr = record.dayofweek;
          }

          await promisifyQuery(
               tenantId,
               `INSERT INTO employeeunavailabledays (employeeid, dayofweek)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE dayofweek = VALUES(dayofweek)`,
               [record.employeeid, dayStr]
          );

          return {
               employeeid: record.employeeid,
               dayofweek: dayStr.split(",").map(day => day.trim()),
          };
     }

     static async getAllUnavailableDays(tenantId: number): Promise<EmployeeUnavailableDay[]> {
          const result = await promisifyQuery(tenantId, "SELECT * FROM employeeunavailabledays");
          return result.map((record: any) => ({
               employeeid: record.employeeid,
               dayofweek: record.dayofweek.split(",").map((day: string) => day.trim()),
          }));
     }

     static async getUnavailableDay(employeeid: number, tenantId: number): Promise<EmployeeUnavailableDay | undefined> {
          const result = await promisifyQuery(
               tenantId,
               `SELECT * FROM employeeunavailabledays
             WHERE employeeid = ?`,
               [employeeid]
          );

          if (result.length === 0) return undefined;

          const record = result[0];
          return {
               employeeid: record.employeeid,
               dayofweek: record.dayofweek.split(",").map((day: string) => day.trim()),
          };
     }

     static async deleteUnavailableDay(employeeid: number, tenantId: number): Promise<number> {
          const result = await promisifyQuery(
               tenantId,
               `DELETE FROM employeeunavailabledays
             WHERE employeeid = ?`,
               [employeeid]
          );
          return result.affectedRows;
     }
}

export default EmployeeShiftService;