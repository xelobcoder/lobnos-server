"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../hooks/helper");
const appointmentTypes_1 = require("./appointmentTypes");
const zod_1 = require("zod");
class Appointment {
    constructor(employeeid) {
        this.connection = helper_1.promisifyQuery;
        this._affectedRows = helper_1.rowAffected;
        this.employeeid = employeeid;
    }
    async isAppointmentTimeAvailable(tenantId, date, time) {
        let refined_date = date;
        if (refined_date.includes("T")) {
            refined_date = refined_date.split("T")[0];
        }
        const _mysql_query = "SELECT * FROM appointments WHERE appointment_date = ? AND appointment_time = ?";
        const rows = await this.connection(tenantId, _mysql_query, [refined_date, time]);
        return !(Array.isArray(rows) && rows.length > 0);
    }
    async createAppointment(tenantId, data) {
        const { patientid, duration, appointment_date, appointment_time, inviteMethod, purpose, title, preference, practioner, location } = data;
        if (!patientid)
            throw new Error("patientid missing");
        if (!(await this.isAppointmentTimeAvailable(tenantId, appointment_date, appointment_time))) {
            return false;
        }
        const createQuery = "INSERT INTO appointments(patientid,duration,appointment_time,appointment_date,inviteMethod,purpose,title,preference,practioner,location) VALUES(?,?,?,?,?,?,?,?,?,?)";
        const result = await this.connection(tenantId, createQuery, [
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
    async getPatientAppointmentHistory(tenantId, patientid, count = 10, page = 1) {
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
	r.username AS practione
	FROM appointments AS a INNER JOIN roles AS r
	ON a.practioner = r.employeeid
	WHERE a.patientid = ? ORDER BY a.refid DESC LIMIT ? OFFSET ?`;
        return await this.connection(tenantId, query, [patientid, count, page]);
    }
    async loadMonthAppointments(tenantId, month) {
        let searchMonth = month;
        if (typeof month === "string") {
            searchMonth = appointmentTypes_1.months[month];
        }
        if (searchMonth !== undefined) {
            return await this.connection(tenantId, "SELECT * FROM appointments WHERE MONTH(appointment_date) = ?", [month]);
        }
        return [];
    }
    getCurrentDateString(datestring) {
        const date = new Date(datestring);
        return `${date.getFullYear()}-${date.getMonth() + 1}-${`${date.getDate()}`.padStart(2, "0")}`;
    }
    convertTimeMinutes(time) {
        if (time.includes(":")) {
            const [hour, minutes] = time.split(":");
            const parsedhour = parseInt(hour);
            const parsedminutes = parseInt(minutes);
            return parsedhour * 60 + parsedminutes;
        }
    }
    popAppointment(range, startpoint, array) {
        return array.filter((item, index) => !(index >= startpoint && index <= startpoint + range - 1));
    }
    async getPractionerAvailableTime(tenantId, employeeid, appointment_date) {
        const currentDate = this.getCurrentDateString(appointment_date);
        const dataset = await this.connection(tenantId, "SELECT duration, appointment_time FROM appointments WHERE appointment_date = ? AND practioner = ?", [currentDate, employeeid]);
        if (dataset.length === 0)
            return appointmentTypes_1.slots;
        let availSlots = [...appointmentTypes_1.slots];
        for (let i = 0; i < dataset.length; i++) {
            const { duration, appointment_time } = dataset[i];
            const aIndex = availSlots.findIndex((u) => u.trim() === appointment_time.trim());
            switch (parseInt(duration)) {
                case 30:
                    availSlots = this.popAppointment(1, aIndex, availSlots);
                    break;
                case 60:
                    availSlots = this.popAppointment(2, aIndex, availSlots);
                    break;
                case 90:
                    availSlots = this.popAppointment(3, aIndex, availSlots);
                    break;
                case 120:
                    availSlots = this.popAppointment(4, aIndex, availSlots);
                    break;
                default:
                    break;
            }
        }
        return availSlots;
    }
    async getDaySchedules(tenantId, type, employeeid, pquery) {
        let query = "SELECT * FROM appointments WHERE appointment_date = CURRENT_DATE";
        const values = [];
        if (employeeid && !isNaN(employeeid) && type !== "general") {
            query += " AND practioner = ? LIMIT ? OFFSET ? ";
            values.push(typeof employeeid === "string" ? parseInt(employeeid) : employeeid);
        }
        values.push(pquery.count);
        values.push(pquery.page);
        return await this.connection(tenantId, query, values);
    }
    getAppointmentCount(tenantId) { }
    /**
      * Get details of a specific appointment by its ID
      */
    async getAppointmentDetails(tenantId, appointmentId) {
        const query = "SELECT * FROM appointments WHERE refid = ?";
        const result = await this.connection(tenantId, query, [appointmentId]);
        return Array.isArray(result) && result.length > 0 ? result[0] : null;
    }
    /**
      * Update an appointment by its ID
      */
    async updateAppointment(tenantId, appointmentId, data) {
        const updateSchema = zod_1.z.object({
            patientid: zod_1.z.number().int(),
            duration: zod_1.z.number().int().optional(),
            status: zod_1.z.string().max(50).optional(),
            appointment_time: zod_1.z.string().max(10).optional(),
            appointment_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            inviteMethod: zod_1.z.string().max(20).optional(),
            purpose: zod_1.z.string().max(500).optional(),
            title: zod_1.z.string().max(300).optional(),
            preference: zod_1.z.string().max(50).optional(),
            practioner: zod_1.z.number().int().optional(),
            location: zod_1.z.string().max(50).optional(),
            notes: zod_1.z.string().max(500).nullable().optional(),
        }).strict();
        const parseResult = updateSchema.safeParse(data);
        if (!parseResult.success) {
            throw new Error("Invalid appointment update fields: " + JSON.stringify(parseResult.error.format()));
        }
        const validData = parseResult.data;
        const fields = Object.keys(validData);
        if (fields.length === 0)
            return false;
        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => validData[field]);
        const query = `UPDATE appointments SET ${setClause} WHERE refid = ?`;
        const result = await this.connection(tenantId, query, [...values, appointmentId]);
        return this._affectedRows(result);
    }
    async deleteAppointment(tenantId, appointmentId) {
        const query = "DELETE FROM appointments WHERE refid = ?";
        const result = await this.connection(tenantId, query, [appointmentId]);
        return this._affectedRows(result);
    }
    async getAllAppointments(tenantId, page = 1, count = 10) {
        const offset = (page - 1) * count;
        const query = `
		    SELECT a.*, np.*, r.username AS practioner_name FROM appointments AS a INNER JOIN new_patients AS np 
		 ON a.patientid = np.patientid
		 INNER JOIN roles AS r ON a.practioner = r.employeeid   
		    ORDER BY refid DESC LIMIT ? OFFSET ?
		`;
        return await this.connection(tenantId, query, [count, offset]);
    }
}
exports.default = Appointment;
