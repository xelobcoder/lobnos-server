import { Request, Response } from "express";
import logger from "../../hooks/logger";
import SQLQueries from "./queries";
import { PaginationType } from "../organization/OrgaInterfac";
import { ConvertKeysToNumbers } from "../../interfaces/global";
import { Clinician } from "./types";
import { paginationQuery, promisifyQuery, rowAffected } from "../../hooks/helper";
import { OperationsFailures } from "../operations/types";
import { PrimeLimsTableclinicianbasicinfo } from "../../database/DatabaseTableSchema";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";

export default class ClinicianClass {
	public async getClinicians(tenantId: number, pagination: ConvertKeysToNumbers<PaginationType> | null): Promise<Clinician[]> {
		const { count = 10, page = 1, role } = pagination;
		if (role && role.toString().trim() === "admin") {
			return (count && page) ? await paginationQuery({ page, count }, SQLQueries.getCliniciansWithExtendedPagination, [], tenantId) :
				await promisifyQuery(tenantId, SQLQueries.getAllCliniciansWithPaymentInfo);
		}
		else {
			return (count && page) ? await paginationQuery({ page, count }, SQLQueries.getCliniciansWithPagination, [], tenantId) :
				await promisifyQuery(tenantId, SQLQueries.getAllClinicians);
		}
	}

	public async getClinicianBasicInfo(tenantId: number, clinicianid: number): Promise<PrimeLimsTableclinicianbasicinfo[]> {
		return await promisifyQuery(tenantId, SQLQueries.getClinicianBasicInfo, [clinicianid]);
	}

	public async getClinicianBatch(tenantId: number, page: number, count: number): Promise<PrimeLimsTableclinicianbasicinfo[]> {
		return await promisifyQuery(tenantId, SQLQueries.getClinicianBatch, [count,page]);
	}

	public async putCliniciansBasic(tenantId: number,
		records: Partial<PrimeLimsTableclinicianbasicinfo>): Promise<string | boolean> {
		const { name, phone, email, location, address, occupation, id } = records;

		const isPhoneValid = TiifuWorkingClass.isNumberPhoneNumber(phone);
		const isEmailValid = TiifuWorkingClass.isEmailValidEmail(email);

		if (!isPhoneValid) return OperationsFailures.invalidPhoneNumber;
		if (email && !isEmailValid) return OperationsFailures.invalidEmail;


		let oldRecordsPackets = await this.getSingleClinician(tenantId, id);

		if (Array.isArray(oldRecordsPackets) && oldRecordsPackets.length > 0) {
			oldRecordsPackets = oldRecordsPackets[0];
			const { email: OldEmail, phone: oldPhone } = oldRecordsPackets;

			if (oldPhone != phone) {
				const isClinicianExist = await this.isClinicianExist(tenantId, email, phone.toString());

				if (isClinicianExist) return OperationsFailures.resourceExist;
			}
		}

		const values = [name, phone, email, location, address, occupation, id];

		const isUpdated = await promisifyQuery(tenantId, SQLQueries.updateClinicianBasicInfo, values);

		return rowAffected(isUpdated);
	}

	static async getTotalClinicians(tenantId: number): Promise<number> {
		const result = await promisifyQuery(tenantId, SQLQueries.getTotalClinicians);
		if (result.length > 0) {
			return result[0].total;
		}
		return 0;
	}

	public async deleteClinicians(tenantId: number, id: number): Promise<boolean | string> {
		const result = await promisifyQuery(tenantId, SQLQueries.deleteClinicianById, [id])
		return rowAffected(result);
	}

	private async isClinicianExist(tenantId: number, email: string, mobile: string): Promise<boolean> {
		if (!email || !mobile) return false;
		const matched = await promisifyQuery(tenantId, `SELECT * FROM clinicianbasicinfo WHERE EMAIL = ? OR phone = ?`, [email, mobile]);
		return matched.length > 0 ? true : false;
	}

	public async postClinicianBasicInfo(req: Request, res: Response): Promise<string | number> {
		const TenantId = req.query.tenantId;
		const { id, name, phone, email, location, address, occupation, organization } = req.body;

		if (!phone) return "Phone number and email required";

		const isPhoneValid = TiifuWorkingClass.isNumberPhoneNumber(phone);
		const isEmailValid = TiifuWorkingClass.isEmailValidEmail(email);

		if (!isPhoneValid) return OperationsFailures.invalidPhoneNumber;
		if (email && !isEmailValid) return OperationsFailures.invalidEmail;

		const tenantIdP = parseInt(TenantId.toString());

		const isClinicianExist = await this.isClinicianExist(tenantIdP, email, phone);

		if (isClinicianExist) return OperationsFailures.resourceExist + " " + "Email or phone number is already registered with a clinician";

		const values = [name, phone, email ? email : null, location, address, occupation, organization];

		try {
			const result = await promisifyQuery(tenantIdP, SQLQueries.insertClinicianBasicInfo, values);
			const { insertId } = result;

			if (insertId !== 0) {
				const random = require("crypto").randomBytes(5).toString("hex");
				const tempCredentials = `UPDATE clinicianscredentials SET password  = ?`;
				await promisifyQuery(tenantIdP, tempCredentials, [random]);
				return insertId;
			}
			return "Adding new clinician failed";
		} catch (err) {
			console.log(err);
			return "Error adding new clinician";
		}
	}

	public async getSingleClinician(tenantId: number, id: number) {
		return await promisifyQuery(tenantId, SQLQueries.getSingleClinicianById, [id]);
	}



	public async getClinicianResult(tenantId: number, clinicianid: number, startdate?: string, enddate?: string): Promise<any[]> {
		try {
			let values: (string | number)[] = [clinicianid];
			let query = SQLQueries.getClinicianResult;

			if (startdate && enddate) {
				query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
				values.push(startdate);
				values.push(enddate);
			} else {
				query += ` AND DATE(b.billedon) = DATE(CURRENT_DATE) ORDER BY b.billedon DESC`;
			}
			const tenantIdP = parseInt(tenantId.toString());
			const result = await promisifyQuery(tenantIdP, query, values);
			return result;
		} catch (error) {
			logger.error(error);
			return [];
		}
	}

	public async getBillingTestBasedByClinician(tenantId: number, billingid: number, clinicianid: number): Promise<any[]> {
		const query = SQLQueries.getBillingTestBasedByClinician;
		const result = await promisifyQuery(tenantId, query, [clinicianid, billingid]);
		return result;
	}
}


