
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import { type TAppointment, type Tpagination, months, slots } from "./appointmentTypes";
import { z } from "zod";

class Appointment {
	employeeid: number;
	private connection = promisifyQuery;
	private _affectedRows = rowAffected;

	constructor(employeeid: number) {
		this.employeeid = employeeid;
	}

	private async isAppointmentTimeAvailable(tenantId: number, date: string, time: string) {
		let refined_date: string = date;
		if (refined_date.includes("T")) {
			refined_date = refined_date.split("T")[0];
		}
		const _mysql_query = "SELECT * FROM appointments WHERE appointment_date = ? AND appointment_time = ?";
		const rows = await this.connection(tenantId, _mysql_query, [refined_date, time]);
		return !(Array.isArray(rows) && rows.length > 0);
	}

	public async createAppointment(tenantId: number, data: TAppointment) {
		const { patientid, duration, appointment_date, appointment_time, inviteMethod, purpose, title, preference, practioner, location } = data;
		if (!patientid) throw new Error("patientid missing");
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

	public async getPatientAppointmentHistory(tenantId: number, patientid: number, count: number = 10, page: number = 1) {
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

	public async loadMonthAppointments(tenantId: number, month: number | string) {
		let searchMonth = month;
		if (typeof month === "string") {
			searchMonth = months[month];
		}
		if (searchMonth !== undefined) {
			return await this.connection(tenantId, "SELECT ta.*, r.username AS practioner,r.employeeid AS practionerid FROM appointments AS ta INNER JOIN roles AS r ON ta.practioner = r.employeeid WHERE MONTH(appointment_date) = ?", [month]);
		}
		return [];
	}

	private getCurrentDateString(datestring: Date | string): string {
		const date = new Date(datestring);
		return `${date.getFullYear()}-${date.getMonth() + 1}-${`${date.getDate()}`.padStart(2, "0")}`;
	}

	private convertTimeMinutes(time: string) {
		if (time.includes(":")) {
			const [hour, minutes] = time.split(":");
			const parsedhour: number = parseInt(hour);
			const parsedminutes: number = parseInt(minutes);
			return parsedhour * 60 + parsedminutes;
		}
	}

	private popAppointment(range: number, startpoint: number, array: string[]) {
		return array.filter((item, index) => !(index >= startpoint && index <= startpoint + range - 1));
	}

	public async getPractionerAvailableTime(tenantId: number, employeeid: number, appointment_date: Date | string) {
		const currentDate = this.getCurrentDateString(appointment_date);
		const dataset = await this.connection(
			tenantId,
			"SELECT duration, appointment_time FROM appointments WHERE appointment_date = ? AND practioner = ?",
			[currentDate, employeeid]
		);
		if (dataset.length === 0) return slots;
		let availSlots: string[] = [...slots];
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

	public async getDaySchedules(tenantId: number, type: string, employeeid: number, pquery: Tpagination) {
		let query = "SELECT * FROM appointments WHERE appointment_date = CURRENT_DATE";
		const values: number[] = [];
		if (employeeid && !isNaN(employeeid) && type !== "general") {
			query += " AND practioner = ? LIMIT ? OFFSET ? ";
			values.push(typeof employeeid === "string" ? parseInt(employeeid) : employeeid);
		}
		values.push(pquery.count);
		values.push(pquery.page);
		return await this.connection(tenantId, query, values);
	}

	public getAppointmentCount(tenantId: number) { }

	/**
	  * Get details of a specific appointment by its ID
	  */
	public async getAppointmentDetails(tenantId: number, appointmentId: number) {
		const query = "SELECT * FROM appointments WHERE refid = ?";
		const result = await this.connection(tenantId, query, [appointmentId]);
		return Array.isArray(result) && result.length > 0 ? result[0] : null;
	}

	/**
	  * Update an appointment by its ID
	  */
	public async updateAppointment(tenantId: number, appointmentId: number, data: Partial<TAppointment>) {

		const updateSchema = z.object({
			patientid: z.number().int(),
			duration: z.number().int().optional(),
			status: z.string().max(50).optional(),
			appointment_time: z.string().max(10).optional(),
			appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			inviteMethod: z.string().max(20).optional(),
			purpose: z.string().max(500).optional(),
			title: z.string().max(300).optional(),
			preference: z.string().max(50).optional(),
			practioner: z.number().int().optional(),
			location: z.string().max(50).optional(),
			notes: z.string().max(500).nullable().optional(),
		}).strict();

		const parseResult = updateSchema.safeParse(data);
		if (!parseResult.success) {
			throw new Error("Invalid appointment update fields: " + JSON.stringify(parseResult.error.format()));
		}
		const validData = parseResult.data;
		const fields = Object.keys(validData);
		if (fields.length === 0) return false;
		// Write the full SQL query with all fields explicitly
		const query = `UPDATE appointments SET
			patientid = ?,
			duration = ?,
			status = ?,
			appointment_time = ?,
			appointment_date = ?,
			inviteMethod = ?,
			purpose = ?,
			title = ?,
			preference = ?,
			practioner = ?,
			location = ?,
			notes = ?
		WHERE refid = ?`;
		// Ensure all fields are present in the correct order, use null if missing
		const values = [
			validData.patientid ?? null,
			validData.duration ?? null,
			validData.status ?? null,
			validData.appointment_time ?? null,
			validData.appointment_date ?? null,
			validData.inviteMethod ?? null,
			validData.purpose ?? null,
			validData.title ?? null,
			validData.preference ?? null,
			validData.practioner ?? null,
			validData.location ?? null,
			validData.notes ?? null,
			appointmentId
		];

		
		const result = await this.connection(tenantId, query, values);
		return this._affectedRows(result);
	}


	public async deleteAppointment(tenantId: number, appointmentId: number) {
		const query = "DELETE FROM appointments WHERE refid = ?";
		const result = await this.connection(tenantId, query, [appointmentId]);
		return this._affectedRows(result);
	}

	public async getAllAppointments(tenantId: number, page: number = 1, count: number = 10, sortby: 'ASC' | 'DESC' = 'DESC') {
		const offset = (page - 1) * count;
		const query = `
			SELECT a.*, np.*, r.username AS practioner_name FROM appointments AS a INNER JOIN new_patients AS np 
		 ON a.patientid = np.patientid
		 INNER JOIN roles AS r ON a.practioner = r.employeeid   
			ORDER BY refid ${sortby} LIMIT ? OFFSET ?
		`
		return await this.connection(tenantId, query, [count, offset]);
	}
}

export default Appointment;
