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
        if (!(await this.isAppointmentTimeAvailable(appointment_date, appointment_time))) {
            return false;
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
    async getPatientAppointmentHistory(patientid, count = 10, page = 1) {
        const query = `SELECT 
    a.appointment_date,
    a.appointment_time,
    a.duration,
    a.preference,
    a.inviteMethod,
    a.purpose,
    a.location,
    a.title,
    a.status,
    r.username AS practioner
    FROM appointments AS a INNER JOIN roles AS r
    ON a.practioner = r.employeeid
    WHERE a.patientid = ? ORDER BY a.refid DESC LIMIT ? OFFSET ?`;
        return await (0, helper_1.promisifyQuery)(query, [patientid, count, page]);
    }
    async loadMonthAppointments(month) {
        var searchMonth = month;
        if (typeof month == "string") {
            const months = {
                january: 1,
                february: 2,
                march: 3,
                april: 4,
                may: 5,
                june: 6,
                july: 7,
                august: 8,
                september: 9,
                october: 10,
                november: 11,
                december: 12,
            };
            searchMonth = months[month];
        }
        if (searchMonth != undefined) {
            const q = `SELECT * FROM appointments WHERE MONTH(appointment_date) = ?`;
            return await this.connection(q, [month]);
        }
        return [];
    }
}
exports.default = Appointment;
