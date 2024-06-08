"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../helper");
class Appointment {
    constructor(employeeid) {
        this.connection = helper_1.promisifyQuery;
        this._affectedRows = helper_1.rowAffected;
        this.employeeid = employeeid;
    }
    async isAppointmentTimeAvailable(date, time) {
        let refined_date = date;
        if (refined_date.includes("T")) {
            refined_date = refined_date.split("T")[0];
        }
        const _mysql_query = `SELECT * FROM appointments WHERE appointment_date = ? AND appointment_time = ?`;
        const rows = await this.connection(_mysql_query, [refined_date, time]);
        return Array.isArray(rows) && rows.length > 0 ? false : true;
    }
    async createAppointment(data) {
        const { patientid, duration, appointment_date, appointment_time, inviteMethod, purpose, title, preference, practioner, location } = data;
        if (!patientid) {
            throw new Error("patientid missing");
        }
        if (!await this.isAppointmentTimeAvailable(appointment_date, appointment_time)) {
            return 'slot taken';
        }
        const createQuery = `INSERT INTO appointments(patientid,duration,appointment_time,appointment_date,inviteMethod,purpose,title,preference,practioner,location) VALUES(?,?,?,?,?,?,?,?,?,?)`;
        const result = await this.connection(createQuery, [
            patientid,
            duration,
            appointment_time,
            appointment_date,
            inviteMethod,
            purpose,
            title,
            preference,
            practioner,
            location,
        ]);
        return this._affectedRows(result);
    }
}
exports.default = Appointment;
