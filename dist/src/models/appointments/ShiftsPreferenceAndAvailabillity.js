"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../hooks/helper");
class EmployeeShiftService {
    static async createPreferredShift(record, tenantId) {
        try {
            const shiftIds = Array.isArray(record.shiftid) ? record.shiftid : [record.shiftid];
            const insertedRecords = [];
            for (const shiftid of shiftIds) {
                await (0, helper_1.promisifyQuery)(tenantId, `INSERT INTO employeepreferredshifts (employeeid, shiftid)
                     VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE shiftid = VALUES(shiftid)`, [record.employeeid, shiftid]);
                insertedRecords.push({ employeeid: record.employeeid, shiftid });
            }
            return insertedRecords;
        }
        catch (err) {
            console.error("Error inserting preferred shifts:", err);
            throw err;
        }
    }
    static async getAllPreferredShifts(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, "SELECT * FROM employeepreferredshifts");
        return result;
    }
    static async getPreferredShift(employeeid, tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM employeepreferredshifts
             JOIN shifts ON shifts.id = employeepreferredshifts.shiftid
             WHERE employeeid = ?`, [employeeid]);
        return result;
    }
    static async deletePreferredShift(employeeid, shiftid, tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM employeepreferredshifts
             WHERE employeeid = ? AND shiftid = ?`, [employeeid, shiftid]);
        return result.affectedRows;
    }
    static async createUnavailableDay(record, tenantId) {
        let dayStr;
        if (Array.isArray(record.dayofweek)) {
            dayStr = record.dayofweek.join(",");
        }
        else {
            dayStr = record.dayofweek;
        }
        await (0, helper_1.promisifyQuery)(tenantId, `INSERT INTO employeeunavailabledays (employeeid, dayofweek)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE dayofweek = VALUES(dayofweek)`, [record.employeeid, dayStr]);
        return {
            employeeid: record.employeeid,
            dayofweek: dayStr.split(",").map(day => day.trim()),
        };
    }
    static async getAllUnavailableDays(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, "SELECT * FROM employeeunavailabledays");
        return result.map((record) => ({
            employeeid: record.employeeid,
            dayofweek: record.dayofweek.split(",").map((day) => day.trim()),
        }));
    }
    static async getUnavailableDay(employeeid, tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM employeeunavailabledays
             WHERE employeeid = ?`, [employeeid]);
        if (result.length === 0)
            return undefined;
        const record = result[0];
        return {
            employeeid: record.employeeid,
            dayofweek: record.dayofweek.split(",").map((day) => day.trim()),
        };
    }
    static async deleteUnavailableDay(employeeid, tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM employeeunavailabledays
             WHERE employeeid = ?`, [employeeid]);
        return result.affectedRows;
    }
}
exports.default = EmployeeShiftService;
