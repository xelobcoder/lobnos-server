import { PrimeLimsTablenew_patients, PrimeLimsTablepatientemmergencycontactinformation, PrimeLimsTablepatientsaddress } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import logger from "../../hooks/logger";
import ApplicationSettings from "../application/appsettings/appset";
import { PrimeEventsSMSDataSource } from "../application/sms/events/PrimeEventsDataSource";
import { OperationsFailures } from "../operations/types";
import { q_filter_patient_using_billingid_query, q_filter_patients, q_new_registation, q_patient_data, q_patient_info_pagination, q_patient_update_emmergency_information, q_patient_update_patient_addressing, q_patient_update_personal_information, q_totalpatientcountQuery } from "./queries";
import { addressInformation, NewRegistration, PatientRecords, registrationOutcome } from "./types";
import { Request, Response } from "express";

export default class Registration {

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

	static async generatePatientFullUniqueId(tenantId: number) {
		const connection = await KnexConnection(tenantId);
		const lastPatient = await connection("new_patients")
			.select("patientid")
			.orderBy("patientid", "desc")
			.first();
		const lastId = lastPatient ? lastPatient.patientid + 1 : 1;
		const paddedId = String(lastId).padStart(6, "0");
		const codeValues = await ApplicationSettings.getLabRegionalAndDistrictCodeAbbreviations(tenantId);
		if (!codeValues) return null;
		return `${codeValues.region}-${paddedId}-${codeValues.district}`;
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

	public static async addPersonalInformation(tenantId: number, records: NewRegistration): Promise<registrationOutcome | void | string> {
		try {
			const missingField = this.getMissingRequiredPatientField(records);
			if (missingField) {
				return `${missingField} is required`;
			}

			const generatedId = await this.generatePatientFullUniqueId(tenantId);
			if (generatedId) {
				const {
					designation,
					firstname,
					lastname,
					middlename,
					age,
					ageType,
					gender,
					employeeid,
					relativecontactname,
					relativecontactnumber,
					email,
					mobile,
					days,
					months,
					maritalstatus,
					occupation,
					patientOrganization,
					years,
					mobileownership = "self",
				} = records;

				let mobileStr: string | undefined = undefined;
				if (mobile) {
					if (typeof mobile === 'string') {
						mobileStr = String(mobile).trim();
					} else if (typeof mobile === 'number' && !isNaN(mobile)) {
						mobileStr = mobile.toString();
					}
				}
				if (mobileownership === 'self' && mobileStr && mobileStr.length > 0) {
					const existingSelf = await promisifyQuery(
						tenantId,
						`SELECT patientid FROM new_patients WHERE mobile_number = ? AND contactpointer = 'self'`,
						[mobileStr]
					);
					if (existingSelf && existingSelf.length > 0) {
						return 'A primary (self) contact already exists for this mobile number.';
					}
				}

				const parsedYear = !isNaN(years) ? parseInt(years.toString()) : 0;
				const parsedMonth = !isNaN(months) ? parseInt(months.toString()) : 0;
				const parsedDay = !isNaN(days) ? parseInt(days.toString()) : 0;

				const isCorrectDOB = (parsedYear > 0 && parsedMonth > 0 && parsedDay > 0);
				const dob = isCorrectDOB ? `${parsedYear}-${parsedMonth}-${parsedDay}` : null;
				const values = [
					firstname,
					lastname,
					middlename,
					email,
					age,
					ageType,
					dob,
					maritalstatus,
					mobile,
					occupation,
					gender,
					patientOrganization,
					generatedId,
					mobileownership,
					designation,
					employeeid,
					relativecontactname,
					relativecontactnumber
				];
				const result = await promisifyQuery(tenantId, q_new_registation, values);
				return result.insertId;
			}
		} catch (error) {
			logger.error("Error in adding personal information:", error);
			return OperationsFailures.internalServerError;
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

	static async UpdatePersonalInformation(tenantId: number, clientdata: NewRegistration, patientid: number): Promise<boolean | string> {
		const isPatientId = await this.checkPatientIdExist(tenantId, patientid);
		if (!isPatientId) return OperationsFailures.notFound;
		const {
			designation,
			firstname,
			lastname,
			middlename,
			age,
			ageType,
			gender,
			email,
			mobile,
			days,
			months,
			maritalstatus,
			occupation,
			patientOrganization,
			years,
			whatAppcontact
		} = clientdata;

		const parsedYear = !isNaN(years) ? parseInt(years.toString()) : 0;
		const parsedMonth = !isNaN(months) ? parseInt(months.toString()) : 0;
		const parsedDay = !isNaN(days) ? parseInt(days.toString()) : 0;

		const isCorrectDOB = (parsedYear > 0 && parsedMonth > 0 && parsedDay > 0);
		const dob = isCorrectDOB ? `${parsedYear}-${parsedMonth}-${parsedDay}` : null;

		const values = [
			firstname,
			designation,
			lastname,
			middlename,
			email,
			age,
			ageType,
			dob,
			maritalstatus,
			mobile,
			occupation,
			gender,
			patientOrganization,
			whatAppcontact,
			patientid,
		];
		const result = await promisifyQuery(tenantId, q_patient_update_personal_information, values);
		return rowAffected(result);
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
		const { data } = request.body;
		const employeeId = request.query.employeeid ? parseInt(request.query.employeeid.toString(), 10) : null;
		if (!employeeId) {
			return response.status(400).send({
				status: "error",
				message: "employeeid is required to add a new patient",
			});
		}
		try {
			const missingField = this.getMissingRequiredPatientField(data || {});
			if (missingField) {
				return response.status(400).send({
					status: "error",
					message: `${missingField} is required`,
				});
			}

			const isAlreadyRegistered = await this.isClientSame(tenantId, data);
			if (isAlreadyRegistered) {
				response.status(404).send({
					status: "warning",
					message:
						data?.mobileownership === "relative"
							? "Number or email is associated with a patient. Please search and bill client to continue."
							: "Number or email is associated with a different patient. Select 'relative' if the person is a relative.",
				});
				return;
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
				new PrimeEventsSMSDataSource(tenantId).patientRegistrationEvent(tenantId, parseInt(insertId.toString()), employeeId);
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
				message: "An error occurred while trying to add a new patient",
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
