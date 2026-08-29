import { record } from "zod";
import { PrimeLimsTablenew_patients, PrimeLimsTablepatientemmergencycontactinformation, PrimeLimsTablepatientsaddress } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";
import { applyNewPatientAfterInsert } from "../../database/appLevelTriggers";
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import logger from "../../hooks/logger";
import ApplicationSettings from "../application/appsettings/appset";
import { InAppNotificationService } from "../application/in-app-notifications/InAppNotificationService";
import { OperationsFailures } from "../operations/types";
import { ICreateNewPatient } from "../patients/interfaces";
import { q_filter_patient_using_billingid_query, q_filter_patients, q_patient_data, q_patient_info_pagination, q_patient_update_emmergency_information, q_patient_update_patient_addressing, q_patient_update_personal_information, q_totalpatientcountQuery } from "./queries";
import { addressInformation, NewRegistration, PatientRecords, registrationOutcome } from "./types";
import { Request, Response } from "express";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import NewPatientsRepo from "../patients/respositories/newPatientsRepo.repo";
import PatientService from "../patients/services/Patient.services";
import { PATIENT_REGISTRATION_FAILURES } from "../patients/enums/Failures.Patient.enum";

export default class Registration {
	private static normalizePhoneTo10(value: any): string | null {
		if (value === undefined || value === null) return null;
		const raw = String(value).trim();
		if (!raw) return null;
		const digits = raw.replace(/\D/g, "");
		if (!digits) return null;
		if (digits.length > 10) return digits.slice(-10);
		return digits;
	}

	private static serializeAuditRecord(record: any) {
		if (!record || typeof record !== "object") return record;
		const normalized = { ...record };
		Object.keys(normalized).forEach((key) => {
			const value = normalized[key];
			if (value instanceof Date) {
				normalized[key] = value.toISOString();
			}
		});
		return normalized;
	}

	private static buildPatientChangedFields(previousData: any, newData: any): Array<{ field: string; oldValue: any; newValue: any }> {
		const previous = Registration.serializeAuditRecord(previousData) || {};
		const current = Registration.serializeAuditRecord(newData) || {};
		const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
		const ignoredKeys = new Set(['date']);
		const changedFields: Array<{ field: string; oldValue: any; newValue: any }> = [];

		for (const key of keys) {
			if (ignoredKeys.has(key)) continue;
			const oldValue = previous[key] ?? null;
			const newValue = current[key] ?? null;
			if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
				changedFields.push({ field: key, oldValue, newValue });
			}
		}
		return changedFields;
	}

	static async createPatientAuditLog(tenantId: number, payload: {
		patientid: number;
		section: string;
		actionType: string;
		changedByEmployeeId?: number | null;
		previousData: any;
		newData: any;
	}) {
		const changedFields = Registration.buildPatientChangedFields(payload.previousData, payload.newData);
		if (changedFields.length === 0) return false;
		const conn = await KnexConnection(tenantId);
		const snapshot = payload.newData && typeof payload.newData === 'object' ? payload.newData : {};
		try {
			await conn('patient_audit_log').insert({
				auditid: conn.raw('UUID()'),
				patientid: snapshot.patientid ?? payload.patientid,
				fullpatientid: snapshot.fullpatientid,
				designation: snapshot.designation ?? null,
				firstname: snapshot.firstname,
				email: snapshot.email ?? null,
				dob: snapshot.dob ?? null,
				age: snapshot.age,
				gender: snapshot.gender ?? null,
				marital_status: snapshot.marital_status ?? null,
				mobile_number: snapshot.mobile_number ?? null,
				agetype: snapshot.agetype,
				occupation: snapshot.occupation ?? null,
				date: snapshot.date ?? conn.fn.now(),
				activation_status: snapshot.activation_status ?? 'FALSE',
				lastname: snapshot.lastname,
				middlename: snapshot.middlename ?? null,
				organization: snapshot.organization ?? null,
				contactpointer: snapshot.contactpointer ?? 'self',
				whatAppcontact: snapshot.whatAppcontact ?? null,
				registeredby: snapshot.registeredby,
				relativecontactname: snapshot.relativecontactname ?? null,
				relativecontactnumber: snapshot.relativecontactnumber ?? null,
				whatsapp_country_code: snapshot.whatsapp_country_code ?? null,
				mobile_country_code: snapshot.mobile_country_code ?? null,
				section: payload.section,
				action_type: payload.actionType,
				changed_by_employeeid: payload.changedByEmployeeId ?? null,
				changed_fields: JSON.stringify(changedFields),
				changed_at: conn.fn.now()
			});
		} catch {
			return false;
		}
		return true;
	}

	static async getPatientAuditHistory(tenantId: number, patientid: number) {
		const conn = await KnexConnection(tenantId);
		const hasAuditTable = await conn.schema.hasTable('patient_audit_log');
		if (!hasAuditTable) return [];
		const rows = await conn('patient_audit_log')
			.leftJoin('roles', 'patient_audit_log.changed_by_employeeid', 'roles.employeeid')
			.select(
				'patient_audit_log.*',
				'roles.username as changed_by_username',
				'roles.role as changed_by_role'
			)
			.where('patient_audit_log.patientid', patientid)
			.orderBy('patient_audit_log.changed_at', 'desc');

		return rows.map((row: any) => ({
			...row,
			changed_fields: (() => {
				if (row.changed_fields === undefined || row.changed_fields === null) return [];
				if (typeof row.changed_fields === 'string') {
					try {
						return JSON.parse(row.changed_fields);
					} catch {
						return [];
					}
				}
				return row.changed_fields;
			})()
		}));
	}

	private static getMissingRequiredPatientField(records: Partial<NewRegistration>): keyof Pick<NewRegistration, "firstname" | "lastname" | "gender" | "age" | "ageType"> | null {
		const requiredFields: Array<keyof Pick<NewRegistration, "firstname" | "lastname" | "gender" | "age" | "ageType">> = ["firstname", "lastname", "gender", "age", "ageType"];
		for (const field of requiredFields) {
			const value = records[field];
			if (value === undefined || value === null) return field;
			if (typeof value === "string" && value.trim() === "") return field;
		}

		return null;
	}

	static async getPatientID(tenantId: number, patientid: number): Promise<number | null | undefined> {
		if (typeof patientid !== "number") {
			throw new TypeError("number required as insertedId");
		}
		const information: PrimeLimsTablenew_patients | null = await new TiifuWorkingClass("new_patients").findOne(tenantId, "patientid", patientid);
		if (!information) return null;
		return information.patientid;

	}

	static patientsInformationBatch(tenantId: number, page: number, count: number): Promise<PrimeLimsTablenew_patients[]> {
		return promisifyQuery(tenantId, q_patient_info_pagination, [count, page]);
	}

	static async getTotalPatients(tenantId: number): Promise<number> {
		const totalPatients = await promisifyQuery(tenantId, q_totalpatientcountQuery);
		if (totalPatients.length > 0) {
			return totalPatients[0].total;
		}
		return 0;
	}



	static async getPatientDataUsingPatientId(tenantId: number, patientid: number): Promise<PrimeLimsTablenew_patients | string | null> {
		if (!patientid) return OperationsFailures.noArgumentsProvided;
		return await new TiifuWorkingClass("new_patients").findOne(tenantId, "patientid", patientid);
	}

	checkEmailOrMobileExist(tenantId: number, email: string, mobile: number): boolean {
		throw new Error("Method not implemented.");
	}

	private static registeredPatientIdOnDatabaseTable(tenantId: number, generatedId: number): Promise<boolean | string> {
		throw new Error("Method not implemented.");
	}

	public static async checkPatientIdExist(tenantId: number, patientid: number): Promise<boolean> {
		let result = await promisifyQuery(tenantId, q_patient_data, [patientid]);
		return result.length > 0;
	}

	public async getPatientBasicData(tenantId: number, patientid: number): Promise<NewRegistration | null> {
		const rows = await promisifyQuery(tenantId, q_patient_data, [patientid]);
		return rows.length > 0 ? rows[0] : null;
	}

	public static async addPersonalInformation(tenantId: number, records: ICreateNewPatient): Promise<number | void | string> {
		try {
			const connection = await KnexConnection(tenantId);
			const transaction = await connection.transaction();
			const patientRepo = new NewPatientsRepo(tenantId, transaction);
			const generatedId = await patientRepo.generatePatientFullUniqueId(tenantId);

			if (!generatedId) throw new Error(PATIENT_REGISTRATION_FAILURES.PATIENT_UNIQUE_ID_GENERATION_FAILED);

			const {
				designation,
				firstname,
				lastname,
				middlename,
				age,
				agetype,
				gender,
				relativecontactname,
				email,
				mobile_number,
				mobile_country_code,
				whatsapp_country_code,
				marital_status,
				dob,
				occupation,
				organization,
				contact_pointer,
			} = records;

			let patientMobileNumber = mobile_number;
			let patientContactPointer = contact_pointer;
			let patientRelativeContactNumber = records.relativecontactnumber;

			if (contact_pointer === "self" && mobile_number) {
				const isRecordExist = await new PatientService(tenantId, transaction).patientMobileRecordExist(mobile_number as number | string);
				if (isRecordExist) {
					patientContactPointer = "relative";
					patientRelativeContactNumber = patientRelativeContactNumber ?? mobile_number;
					patientMobileNumber = null as any;
				}
			}


			const dateofBirth = dob ? new Date(dob).toISOString().split("T")[0] : null;


			const patientData = {
				firstname,
				lastname,
				middlename: middlename ?? null,
				email: email ?? null,
				age,
				agetype: agetype,
				dob: dateofBirth,
				marital_status,
				mobile_number: patientMobileNumber,
				occupation: occupation ?? null,
				gender: gender ?? null,
				organization: organization ?? null,
				fullpatientid: generatedId,
				contactpointer: patientContactPointer,
				designation: designation ?? null,
				registeredby: records.registeredby,
				relativecontactname: relativecontactname ?? null,
				relativecontactnumber: patientRelativeContactNumber ?? null,
				whatsapp_country_code: whatsapp_country_code ?? null,
				mobile_country_code: mobile_country_code ?? null,
				whatAppcontact: records.whatAppcontact ?? null,
			}

			const sanitizedPatientData = new TiifuWorkingClass("new_patients").ignoredNullUndefinedProperties(patientData);


			const insertOutcome = await patientRepo.create(sanitizedPatientData);

			const patientid = Array.isArray(insertOutcome) ? insertOutcome[0] : insertOutcome;

			if (!patientid || typeof patientid !== "number") {
				throw new Error("Failed to create patient");
			}

			await applyNewPatientAfterInsert(transaction, {
				patientid,
				firstname,
				lastname,
			});

			await transaction.commit();
			return patientid;
		} catch (error) {
			throw new Error(`Error adding personal information: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	static async emmergencyInformation(tenantId: number, id: number, records: Partial<PrimeLimsTablepatientemmergencycontactinformation>) {
		const { emmergencyContactName, emmergencyContactNumber, relationship, address, occupation } = records;
		const values = [emmergencyContactName, emmergencyContactNumber, relationship, occupation, address, id];
		return rowAffected(await promisifyQuery(tenantId, q_patient_update_emmergency_information, values));
	}

	public async getCustomersRecords(tenantId: number, data: PatientRecords): Promise<NewRegistration | null | NewRegistration[]> {
		const { count = 10, mobile, page = 1, fullname, email, patientid, from, to, sortby = 'DESC' } = data;
		var query = q_filter_patients;
		if (patientid) {
			const is_valid_ptid: boolean = await Registration.checkPatientIdExist(tenantId, patientid);
			if (is_valid_ptid) {
				return await this.getPatientBasicData(tenantId, patientid);
			}
		}
		const values = [];
		let conditions = [];
		const mob_str = `${mobile}`;
		var isMobright = mobile && mob_str.length == 10 && mob_str.charAt(0) == "0" && !isNaN(mobile);
		var mobileNum: string;
		if (mobile && !isMobright && mob_str.length == 9 && mob_str.charAt(0) != "0") {
			mobileNum = mob_str.padStart(10, "0");
			conditions.push(`np.mobile_number = ?`);
			values.push(mobileNum);
		}
		if (fullname && fullname.length > 2) {
			conditions.push(`CONCAT(np.firstname, ' ', COALESCE(np.middlename, ''), ' ', np.lastname) LIKE ?`);
			values.push(`%${fullname}%`);
		}
		if (email && email.includes("@")) {
			conditions.push(` np.email = ?`);
			values.push(email);
		}
		if (from) {
			conditions.push(`np.date >= ?`);
			values.push(from);
		}
		if (to) {
			conditions.push(`np.date <= ?`);
			values.push(to);
		}
		if (conditions.length > 0) {
			query += ` WHERE ` + conditions.join(" AND ");
		}
		const offset = (page - 1) * count;
		values.push(parseInt(count.toString()));
		values.push(offset);
		query += sortby ? ` ORDER BY np.patientid ${sortby} LIMIT ? OFFSET ? ` : ` ORDER BY np.patientid DESC LIMIT ? OFFSET ? `;

		try {
			let result = await promisifyQuery(tenantId, query, values);
			return result;
		} catch (err) {
			return [];
		}
	}

	addressingInformation(tenantId: number, paientid: number, records: addressInformation): Promise<boolean | void> {
		throw new Error("Method not implemented.");
	}

	static async UpdatePersonalInformation(tenantId: number, clientdata: Partial<ICreateNewPatient>, patientid: number): Promise<boolean | string> {
		const isPatientId = await this.checkPatientIdExist(tenantId, patientid);
		if (!isPatientId) return OperationsFailures.notFound;
		const previousData = await this.getPatientDataUsingPatientId(tenantId, patientid);
		const {
			designation,
			firstname,
			lastname,
			middlename,
			age,
			agetype,
			gender,
			email,
			mobile_number,
			contact_pointer = "self",
			marital_status,
			occupation,
			organization,
			dob,
			whatAppcontact,
			registeredby
		} = clientdata;

		const values = [
			firstname,
			designation,
			lastname,
			middlename,
			email,
			age,
			agetype,
			dob ? dob.toString().split("T")[0] : null,
			marital_status,
			mobile_number,
			occupation,
			gender,
			organization,
			whatAppcontact,
			patientid,
		];
		const result = await promisifyQuery(tenantId, q_patient_update_personal_information, values);
		const updated = rowAffected(result);
		if (updated) {
			const newData = await this.getPatientDataUsingPatientId(tenantId, patientid);
			await this.createPatientAuditLog(tenantId, {
				patientid,
				section: 'personal_information',
				actionType: 'UPDATE',
				changedByEmployeeId: registeredby ? parseInt(registeredby.toString()) : null,
				previousData,
				newData
			});
		}
		return updated;
	}

	public async getPatientInfoUsingBillingId(tenantId: number, billingid: number) {
		const result = await promisifyQuery(tenantId, q_filter_patient_using_billingid_query, [billingid]);
		return result;
	}

	public static async isBulkRegistration(tenantId: number) {
		try {
			const query = `SELECT bulkregistration FROM applicationsettings`;
			const result = await promisifyQuery(tenantId, query);
			if (result.length === 0) return false;
			const { bulkregistration } = result[0];
			return bulkregistration === 1;
		} catch (err: any) {
			throw new Error(err);
		}
	}

	static async addressingInformationStatic(tenantId: number, id: number, records: PrimeLimsTablepatientsaddress & { districtCode: string }) {
		try {
			const { area, region, gpsLocation, address, country, districtCode } = records;
			const values = [area, country, districtCode, region, gpsLocation, address, id];
			const result = rowAffected(await promisifyQuery(tenantId, q_patient_update_patient_addressing, values));
			return result;
		} catch (err: any) {
			throw new Error(err?.message || err);
		}
	}


	static async isClientSame(tenantId: number, clientdata: NewRegistration): Promise<boolean> {
		try {
			if (!clientdata || (typeof clientdata !== 'object')) {
				logger.error('isClientSame: Invalid clientdata');
				return false;
			}
			const { mobile, mobileownership, email } = clientdata;

			const verifyOwnerShip = (result: any[]): boolean => {
				if (result && result.length > 0) {
					return mobileownership !== 'relative';
				}
				return false;
			};

			if (mobile) {
				let mobileStr: string | undefined = undefined;
				if (typeof mobile === 'string') {
					mobileStr = String(mobile).trim();
				} else if (typeof mobile === 'number' && !isNaN(mobile)) {
					mobileStr = mobile.toString();
				}
				if (mobileStr && mobileStr.length > 0 && /^\d{9,15}$/.test(mobileStr)) {
					const result = await promisifyQuery(
						tenantId,
						`SELECT mobile_number AS mobile FROM new_patients WHERE mobile_number = ? AND contactpointer = 'self'`,
						[mobileStr]
					);
					return verifyOwnerShip(result);
				}
			}

			if (email && typeof email === 'string' && email.trim().length > 0 && email.includes("@")) {
				const result = await promisifyQuery(
					tenantId,
					`SELECT email FROM new_patients WHERE email = ?`,
					[email.trim()]
				);
				return verifyOwnerShip(result);
			}

			return false;
		} catch (err) {
			logger.error('isClientSame error:', err);
			return false;
		}
	}

	static async addNewPatient(tenantId: number, request: Request, response: Response): Promise<Response | void> {
		const data = request.body;
		const employeeId = request.query.employeeid ? parseInt(request.query.employeeid.toString(), 10) : null;
		if (!employeeId) {
			return response.status(400).send({
				status: "error",
				message: "employeeid is required to add a new patient",
			});
		}
		try {
			await new PatientService(tenantId).moveDuplicateSelfMobileToRelative(data);

			const isAlreadyRegistered = await this.isClientSame(tenantId, data);
			if (isAlreadyRegistered && data.contact_pointer == "self") {
				response.status(404).send({
					status: "warning",
					message:
						data?.mobileownership === "relative"
							? "Number or email is associated with a patient. Please search and bill client to continue."
							: "Number or email is associated with a different patient. Select 'relative' if the person is a relative.",
				});
				return;
			}

			if (data.contact_pointer !== "self") {
				data.mobile_number = null;
			}


			const insertId = await this.addPersonalInformation(tenantId, { ...data, employeeid: employeeId });

			if (typeof insertId === "string") {
				return response.status(400).send({
					status: "error",
					message: insertId,
				});
			}

			if (insertId) {
				response.status(200).send({
					status: "success",
					message: "New patient added successfully",
					patientid: insertId,
				});
				const patientName = [data.firstname, data.middlename, data.lastname].filter(Boolean).join(" ");
				InAppNotificationService.publish(tenantId, {
					eventCode: 'PATIENT_CREATED',
					module: 'registration',
					title: 'Patient registered',
					message: `${patientName || 'A patient'} was registered.`,
					referenceType: 'patient',
					referenceId: Number(insertId),
					actorEmployeeId: employeeId,
				}).catch((err) => logger.error('PATIENT_CREATED in-app notification failed', err));
			}
			else {
				response.status(400).send({
					status: "error",
					message: "Failed to add new patient. Please try again.",
				});
			}

		} catch (error: any) {
			response.status(500).send({
				status: "error",
				message: error instanceof Error ? error.message : String(error),
				error: error.message || error,
			});
		}
	}


	static async AdvancedPatientFilter(tenantid: number, requestbody: Partial<NewRegistration> & { startDate?: string; endDate?: string }): Promise<PrimeLimsTablenew_patients[]> {
		try {
			const filters = requestbody;
			if (!filters || Object.keys(filters).length === 0) throw new Error("No filter criteria provided");

			const fieldMapping: Record<string, string> = {
				"patientid": "patientid",
				"firstname": "firstname",
				"lastname": "lastname",
				"middlename": "middlename",
				"fullpatientid": "fullpatientid",
				"email": "email",
				"mobile_number": "mobile_number",
				"gender": "gender",
				"maritalstatus": "marital_status",
				"patientOrganization": "organization",
				"occupation": "occupation"
			};

			const db = await KnexConnection(tenantid);
			let query = db("new_patients")
				.leftJoin("roles as rr", "new_patients.registeredby", "rr.employeeid")
				.select(
					"new_patients.patientid",
					"new_patients.fullpatientid",
					"new_patients.firstname",
					"new_patients.lastname",
					"new_patients.middlename",
					"new_patients.gender",
					"new_patients.age",
					"new_patients.mobile_number as contact",
					"new_patients.mobile_number",
					"new_patients.ageType",
					"new_patients.email",
					"new_patients.organization",
					"new_patients.registeredby",
					"rr.username as registeredbyusername",
					"new_patients.date",
					db.raw("CONCAT(new_patients.firstname, ' ', COALESCE(new_patients.middlename, ''), ' ', new_patients.lastname) as fullname")
				);


			for (const field in filters) {
				const dbColumn = fieldMapping[field];
				if (!dbColumn) continue;
				const value = (filters as Record<string, any>)[field];
				if (value === null || value === undefined || value === "") continue;

				if (dbColumn === "gender" || dbColumn === "marital_status") {
					query = query.andWhere(`new_patients.${dbColumn}`, value.toLowerCase());
				} else if (dbColumn === "mobile_number") {

					let mobileStr = String(value).trim();
					let normalizedWith0: string;
					let normalizedWithout0: string;

					if (mobileStr.length === 10 && mobileStr.charAt(0) === "0") {
						normalizedWith0 = mobileStr;
						normalizedWithout0 = mobileStr.substring(1);
					} else if (mobileStr.length === 9) {
						normalizedWith0 = mobileStr.padStart(10, "0");
						normalizedWithout0 = mobileStr;
					} else {
						normalizedWith0 = mobileStr;
						normalizedWithout0 = mobileStr;
					}

					query = query.andWhere(q => {
						q.where(`new_patients.${dbColumn}`, "=", normalizedWith0)
							.orWhere(`new_patients.${dbColumn}`, "=", normalizedWithout0);
					});
				} else {
					query = query.andWhere(`new_patients.${dbColumn}`, "=", value);
				}
			}

			const { startDate, endDate } = filters;
			if (startDate) {
				query = query.andWhere(db.raw("DATE(new_patients.date) >= ?", [startDate]));
			}
			if (endDate) {
				query = query.andWhere(db.raw("DATE(new_patients.date) <= ?", [endDate]));
			}

			const patients = await query
				.orderBy("patientid", "desc")
				.limit(30)


			return patients;
		} catch (error: any) {
			throw error;
		}
	}
}
