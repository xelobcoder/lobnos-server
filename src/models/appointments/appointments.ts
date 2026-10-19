
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import { type TAppointment, type Tpagination, months, slots } from "./appointmentTypes";
import { z } from "zod";
import {
	AppointmentConflictError,
	AppointmentLinks,
	AppointmentType,
	AppointmentValidationError,
	APPOINTMENT_TYPES,
	CANCELLED_APPOINTMENT_STATUSES,
	WORKFLOW_APPOINTMENT_TYPES,
	assertAppointmentLinks,
	assertServicesAllowed,
	normalizeAppointmentRow,
	normalizeAppointmentRows,
	normalizeAppointmentType,
	parseAppointmentMetadata,
	parseServiceIds,
	resolveCreateLinks,
	serviceMatchesType,
	storedServiceIds,
} from "./appointmentValidation";

class Appointment {
	employeeid: number;
	private connection = promisifyQuery;
	private _affectedRows = rowAffected;

	constructor(employeeid: number) {
		this.employeeid = employeeid;
	}

	private normalizeDateOnly(value: Date | string): string {
		if (typeof value === "string") {
			const trimmed = value.trim();
			const isoLikeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s].*$/);
			if (isoLikeMatch) {
				return isoLikeMatch[1];
			}
			if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
				return trimmed;
			}
		}

		const parsed = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			throw new Error("Invalid appointment_date format");
		}

		const year = parsed.getFullYear();
		const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
		const day = `${parsed.getDate()}`.padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private practitionerId(value: unknown): number | null {
		const raw = value && typeof value === "object" ? (value as any).employeeid : value;
		const id = Number(raw);
		return Number.isSafeInteger(id) && id > 0 ? id : null;
	}

	/** A practitioner can only hold one live (non-cancelled) booking per slot. */
	private async isAppointmentTimeAvailable(tenantId: number, date: string, time: string, practitionerId: number | null) {
		const refined_date = this.normalizeDateOnly(date);
		let _mysql_query = `SELECT refid FROM appointments WHERE appointment_date = ? AND appointment_time = ?
			AND LOWER(COALESCE(status, '')) NOT IN (${CANCELLED_APPOINTMENT_STATUSES.map(() => "?").join(",")})`;
		const values: unknown[] = [refined_date, time, ...CANCELLED_APPOINTMENT_STATUSES];
		if (practitionerId) {
			_mysql_query += " AND practioner = ?";
			values.push(practitionerId);
		}
		const rows = await this.connection(tenantId, `${_mysql_query} LIMIT 1`, values);
		return !(Array.isArray(rows) && rows.length > 0);
	}

	/** Rejects a second live booking for the same patient (or lead) at the same date and time. */
	private async assertNoDuplicateBooking(
		tenantId: number,
		links: { patientid: number | null; lead_id: number | null },
		date: string,
		time: string,
		excludeRefid?: number,
	) {
		const owners: string[] = [];
		const values: unknown[] = [date, time];
		if (links.patientid) { owners.push("patientid = ?"); values.push(links.patientid); }
		if (links.lead_id) { owners.push("lead_id = ?"); values.push(links.lead_id); }
		if (owners.length === 0 || !time) return;
		let query = `SELECT refid FROM appointments WHERE appointment_date = ? AND appointment_time = ? AND (${owners.join(" OR ")})
			AND LOWER(COALESCE(status, '')) NOT IN (${CANCELLED_APPOINTMENT_STATUSES.map(() => "?").join(",")})`;
		values.push(...CANCELLED_APPOINTMENT_STATUSES);
		if (excludeRefid) { query += " AND refid <> ?"; values.push(excludeRefid); }
		const rows = await this.connection(tenantId, `${query} LIMIT 1`, values);
		if (Array.isArray(rows) && rows.length > 0) {
			throw new AppointmentConflictError(
				`This ${links.patientid ? "patient" : "lead"} already has an appointment on ${date} at ${time} (appointment #${rows[0].refid}).`
			);
		}
	}

	/** Booked services must be billable tests of the matching department (Ultrasound vs laboratory). */
	private async assertServicesExist(tenantId: number, type: AppointmentType, serviceIds: number[]) {
		if (serviceIds.length === 0) return;
		const rows = await this.connection(
			tenantId,
			`SELECT tp.id, d.department FROM test_panels AS tp
			INNER JOIN testdetails AS td ON td.testid = tp.id
			LEFT JOIN departments AS d ON d.id = tp.category
			WHERE tp.id IN (${serviceIds.map(() => "?").join(",")})`,
			serviceIds
		);
		const found = new Map<number, unknown>((Array.isArray(rows) ? rows : []).map((row: any) => [Number(row.id), row.department]));
		const missing = serviceIds.filter((id) => !found.has(id));
		if (missing.length) throw new AppointmentValidationError(`Selected service(s) not found: ${missing.join(", ")}`);
		const mismatched = serviceIds.filter((id) => !serviceMatchesType(type, found.get(id)));
		if (mismatched.length) {
			throw new AppointmentValidationError(
				type === "ultrasound"
					? "Ultrasound appointments can only book Ultrasound department services"
					: "Laboratory appointments cannot book Ultrasound department services"
			);
		}
	}

	public async createAppointment(tenantId: number, data: TAppointment) {
		try {
			const { duration, appointment_date, appointment_time, inviteMethod, purpose, title, preference, practioner, location } = data;
			const links = resolveCreateLinks(data as unknown as Record<string, unknown>);
			const serviceIds = parseServiceIds((data as any).service_ids) ?? [];
			assertServicesAllowed(links.appointment_type, serviceIds);
			await this.assertLinkedRecords(tenantId, links);
			await this.assertServicesExist(tenantId, links.appointment_type, serviceIds);
			const normalizedAppointmentDate = this.normalizeDateOnly(appointment_date);
			await this.assertNoDuplicateBooking(tenantId, links, normalizedAppointmentDate, appointment_time);
			if (!(await this.isAppointmentTimeAvailable(tenantId, normalizedAppointmentDate, appointment_time, this.practitionerId(practioner)))) return false;
			// service_ids is only written when supplied so legacy inserts keep their exact shape.
			const serviceColumn = serviceIds.length ? ",service_ids" : "";
			const createQuery = `INSERT INTO appointments(patientid,duration,appointment_time,appointment_date,inviteMethod,purpose,title,preference,practioner,location,appointment_type,lead_id,billingid${serviceColumn}) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?${serviceIds.length ? ",?" : ""})`;
			const result = await this.connection(tenantId, createQuery, [
				links.patientid,
				duration,
				appointment_time,
				normalizedAppointmentDate,
				inviteMethod,
				purpose,
				title,
				preference,
				practioner,
				location,
				links.appointment_type,
				links.lead_id,
				links.billingid,
				...(serviceIds.length ? [JSON.stringify(serviceIds)] : []),
			]);

			const insertId = Number((result as any)?.insertId ?? 0);
			if (insertId > 0) {
				return { success: true, appointmentId: insertId, refid: insertId };
			}
			return this._affectedRows(result);
		} catch (error) {
			if (error instanceof AppointmentValidationError) throw error;
			throw new Error(`Failed to create appointment: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Verifies that newly linked CRM leads / workflow billings exist in this tenant and that a
	 * workflow billing belongs to the appointment patient.
	 */
	private async assertLinkedRecords(tenantId: number, links: AppointmentLinks, previous?: Partial<AppointmentLinks>) {
		if (links.lead_id && links.lead_id !== previous?.lead_id) {
			const leads = await this.connection(tenantId, "SELECT id FROM leads WHERE id = ? LIMIT 1", [links.lead_id]);
			if (!(Array.isArray(leads) && leads.length > 0)) throw new AppointmentValidationError("lead_id does not reference an existing lead");
		}
		if (links.billingid && (links.billingid !== previous?.billingid || links.patientid !== previous?.patientid)) {
			const billings = await this.connection(tenantId, "SELECT patientid FROM billing WHERE billingid = ? LIMIT 1", [links.billingid]);
			const billing = Array.isArray(billings) ? billings[0] : undefined;
			if (!billing) throw new AppointmentValidationError("billingid does not reference an existing billing");
			if (Number(billing.patientid) !== Number(links.patientid)) {
				throw new AppointmentValidationError("billingid belongs to a different patient");
			}
		}
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
	a.appointment_type,
	a.lead_id,
	a.billingid,
	r.username AS practione
	FROM appointments AS a INNER JOIN roles AS r
	ON a.practioner = r.employeeid
	WHERE a.patientid = ? ORDER BY a.refid DESC LIMIT ? OFFSET ?`;
		return normalizeAppointmentRows(await this.connection(tenantId, query, [patientid, count, page]));
	}

	public async loadMonthAppointments(tenantId: number, month: number | string) {
		let searchMonth = month;
		if (typeof month === "string") {
			searchMonth = months[month];
		}
		if (searchMonth !== undefined) {
			return normalizeAppointmentRows(await this.connection(tenantId, "SELECT ta.*, r.username AS practioner,r.employeeid AS practionerid FROM appointments AS ta INNER JOIN roles AS r ON ta.practioner = r.employeeid WHERE MONTH(appointment_date) = ?", [month]));
		}
		return [];
	}

	/** Inclusive, year-aware calendar query. Dates must already be validated YYYY-MM-DD strings. */
	public async loadAppointmentsInRange(tenantId: number, startDate: string, endDate: string) {
		const crmTables = await this.connection(
			tenantId,
			"SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
			["leads"]
		);
		const hasLeadsTable = Array.isArray(crmTables) && crmTables.length > 0;
		const leadColumns = hasLeadsTable
			? ", l.firstname AS lead_firstname, l.lastname AS lead_lastname, l.company_name AS lead_company, l.contact_person AS lead_name"
			: ", NULL AS lead_firstname, NULL AS lead_lastname, NULL AS lead_company, NULL AS lead_name";
		const leadJoin = hasLeadsTable ? " LEFT JOIN leads AS l ON ta.lead_id = l.id" : "";
		const query = `SELECT ta.*, r.username AS practioner, r.employeeid AS practionerid,
			np.firstname AS firstname, np.middlename AS middlename, np.lastname AS lastname,
			np.designation AS designation${leadColumns}
			FROM appointments AS ta
			INNER JOIN roles AS r ON ta.practioner = r.employeeid
			LEFT JOIN new_patients AS np ON ta.patientid = np.patientid${leadJoin}
			WHERE ta.appointment_date BETWEEN ? AND ?
			ORDER BY ta.appointment_date ASC, ta.appointment_time ASC`;
		return normalizeAppointmentRows(await this.connection(tenantId, query, [startDate, endDate]));
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
		return Array.isArray(result) && result.length > 0 ? normalizeAppointmentRow(result[0]) : null;
	}

	/**
	  * Update an appointment by its ID
	  */
	public async updateAppointment(tenantId: number, appointmentId: number, data: Partial<TAppointment>) {
		const normalizedData = {
			...data,
			appointment_date: data.appointment_date ? this.normalizeDateOnly(data.appointment_date) : data.appointment_date,
		};

		const updateSchema = z.object({
			patientid: z.number().int().positive().nullable().optional(),
			duration: z.number().int().optional(),
			status: z.string().max(50).optional(),
			appointment_time: z.string().max(10).optional(),
			appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			inviteMethod: z.string().max(20).optional(),
			purpose: z.string(),
			title: z.string().optional(),
			preference: z.string().optional(),
			practioner: z.number().int().optional(),
			location: z.string().optional(),
			notes: z.string().nullable().optional(),
			appointment_type: z.enum(APPOINTMENT_TYPES).nullable().optional(),
			lead_id: z.number().int().positive().nullable().optional(),
			billingid: z.number().int().positive().nullable().optional(),
			service_ids: z.array(z.number().int().positive()).max(50).nullable().optional(),
		}).strict();

		const metadata = parseAppointmentMetadata(normalizedData as Record<string, unknown>);
		for (const key of ["patientid", "lead_id", "billingid", "appointment_type"] as const) {
			if (metadata[key] !== undefined) (normalizedData as any)[key] = metadata[key];
		}
		if ((normalizedData as any).service_ids !== undefined) {
			(normalizedData as any).service_ids = parseServiceIds((normalizedData as any).service_ids);
		}

		const parseResult = updateSchema.safeParse(normalizedData);
		if (!parseResult.success) {
			throw new Error("Invalid appointment update fields: " + JSON.stringify(parseResult.error.format()));
		}
		const validData = parseResult.data;
		const fields = Object.keys(validData);
		if (fields.length === 0) return false;

		// Link/type columns are only written when supplied, so legacy clients never clear them.
		const linkColumns: string[] = (["patientid", "appointment_type", "lead_id", "billingid"] as const)
			.filter((key) => validData[key] !== undefined);
		const linkValues: unknown[] = linkColumns.map((key) => (validData as any)[key] ?? null);
		const servicesSupplied = validData.service_ids !== undefined;
		const rescheduled = Boolean(validData.appointment_date && validData.appointment_time);
		if (linkColumns.length > 0 || servicesSupplied || rescheduled) {
			const current = await this.getAppointmentDetails(tenantId, appointmentId);
			if (!current && (linkColumns.length > 0 || servicesSupplied)) return false;
			if (current) {
				const previous: AppointmentLinks = {
					patientid: current.patientid ?? null,
					lead_id: current.lead_id ?? null,
					billingid: current.billingid ?? null,
					appointment_type: normalizeAppointmentType(current.appointment_type),
				};
				const needsLinkValidation = linkColumns.length > 0 || servicesSupplied;
				const candidate: AppointmentLinks = {
					patientid: validData.patientid !== undefined ? validData.patientid : previous.patientid,
					lead_id: validData.lead_id !== undefined ? validData.lead_id : previous.lead_id,
					billingid: validData.billingid !== undefined ? validData.billingid : previous.billingid,
					appointment_type: validData.appointment_type !== undefined
						? normalizeAppointmentType(validData.appointment_type)
						: previous.appointment_type,
				};
				// Reschedule-only updates of legacy rows must not start failing on link rules.
				const merged = needsLinkValidation ? assertAppointmentLinks(candidate) : candidate;
				if (linkColumns.length > 0) await this.assertLinkedRecords(tenantId, merged, previous);
				if (validData.appointment_type !== undefined) {
					validData.appointment_type = merged.appointment_type;
					linkValues[linkColumns.indexOf("appointment_type")] = merged.appointment_type;
				}

				const currentServices = storedServiceIds(current.service_ids);
				const typeChanged = merged.appointment_type !== previous.appointment_type;
				if (servicesSupplied || (typeChanged && currentServices.length > 0)) {
					let nextServices = servicesSupplied ? (validData.service_ids ?? []) : currentServices;
					// Moving to a non-workflow type drops the booked services instead of failing.
					if (!servicesSupplied && !WORKFLOW_APPOINTMENT_TYPES.includes(merged.appointment_type)) nextServices = [];
					assertServicesAllowed(merged.appointment_type, nextServices);
					if (previous.billingid && JSON.stringify(nextServices) !== JSON.stringify(currentServices)) {
						throw new AppointmentConflictError("This appointment has already been billed; its services can no longer be changed.");
					}
					await this.assertServicesExist(tenantId, merged.appointment_type, nextServices);
					linkColumns.push("service_ids");
					linkValues.push(nextServices.length ? JSON.stringify(nextServices) : null);
				}

				if (rescheduled) {
					await this.assertNoDuplicateBooking(
						tenantId,
						merged,
						validData.appointment_date as string,
						validData.appointment_time as string,
						appointmentId,
					);
				}
			}
		}
		const linkAssignments = linkColumns.map((key) => `,\n\t\t\t${key} = ?`).join("");

		// Reminder flags are evaluated BEFORE date/time are assigned (MySQL applies SET left to right),
		// so a reschedule re-arms the 24h/30m reminders and the old schedule can never fire.
		const sameSchedule = "(appointment_date <=> ? AND appointment_time <=> ?)";
		const query = `UPDATE appointments SET
			reminder_24h_sent_at = IF(${sameSchedule}, reminder_24h_sent_at, NULL),
			reminder_30m_sent_at = IF(${sameSchedule}, reminder_30m_sent_at, NULL),
			reminder_attempts = IF(${sameSchedule}, reminder_attempts, 0),
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
			notes = ?${linkAssignments}
		WHERE refid = ?`;
		// Ensure all fields are present in the correct order, use null if missing
		const scheduleValues = [validData.appointment_date ?? null, validData.appointment_time ?? null];
		const values = [
			...scheduleValues,
			...scheduleValues,
			...scheduleValues,
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
			...linkValues,
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
		const direction = String(sortby).toUpperCase() === "ASC" ? "ASC" : "DESC";
		const query = `
			SELECT a.*, np.*, a.patientid AS patientid, a.appointment_type, a.lead_id, a.billingid, r.username AS practioner_name FROM appointments AS a LEFT JOIN new_patients AS np
		 ON a.patientid = np.patientid
		 INNER JOIN roles AS r ON a.practioner = r.employeeid   
			WHERE (np.patientid IS NOT NULL OR a.lead_id IS NOT NULL)
			ORDER BY refid ${direction} LIMIT ? OFFSET ?
		`
		return normalizeAppointmentRows(await this.connection(tenantId, query, [count, offset]));
	}
}

export default Appointment;
