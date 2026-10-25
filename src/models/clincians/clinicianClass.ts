import { Request, Response } from "express";
import logger from "../../hooks/logger";
import SQLQueries from "./queries";
import { PaginationType } from "../organization/OrgaInterfac";
import { ConvertKeysToNumbers } from "../../interfaces/global";
import { Clinician, ClinicianFilterParams } from "./types";
import { paginationQuery, promisifyQuery, rowAffected } from "../../hooks/helper";
import { OperationsFailures } from "../operations/types";
import { PrimeLimsTableclinicianbasicinfo } from "../../database/DatabaseTableSchema";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { ReferralCodingRepo } from "../referral/repositories/ReferralCodingRepo";
import KnexConnection from "../../database/KnexConnections";
import { applyClinicianAfterDelete, applyClinicianAfterInsert } from "../../database/appLevelTriggers";
import { roleAllowed } from "../../middleware/roles";

export default class ClinicianClass {

	/**
	 * Build WHERE clause and parameters for filtering clinicians
	 */
	private buildFilterQuery(filters: ClinicianFilterParams): { whereClause: string; params: any[] } {
		const params: any[] = [];
		const conditions: string[] = [];

		// Full text search - searches across multiple fields
		if (filters.searchText && filters.searchText.toString().trim() !== "") {
			const searchTerm = `%${filters.searchText}%`;
			conditions.push(
				`(name LIKE ? OR phone LIKE ? OR email LIKE ? OR location LIKE ? OR address LIKE ? OR occupation LIKE ? OR identifier LIKE ?)`
			);
			for (let i = 0; i < 7; i++) {
				params.push(searchTerm);
			}
		}

		// Individual field filters
		if (filters.id) {
			conditions.push("id = ?");
			params.push(filters.id);
		}
		if (filters.name && filters.name.toString().trim() !== "") {
			conditions.push("name LIKE ?");
			params.push(`%${filters.name}%`);
		}
		if (filters.location && filters.location.toString().trim() !== "") {
			conditions.push("location LIKE ?");
			params.push(`%${filters.location}%`);
		}
		if (filters.address && filters.address.toString().trim() !== "") {
			conditions.push("address LIKE ?");
			params.push(`%${filters.address}%`);
		}
		if (filters.occupation && filters.occupation.toString().trim() !== "") {
			conditions.push("occupation LIKE ?");
			params.push(`%${filters.occupation}%`);
		}
		if (filters.organization) {
			conditions.push("organization = ?");
			params.push(filters.organization);
		}
		if (filters.phone && filters.phone.toString().trim() !== "") {
			conditions.push("phone LIKE ?");
			params.push(`%${filters.phone}%`);
		}
		if (filters.email && filters.email.toString().trim() !== "") {
			conditions.push("email LIKE ?");
			params.push(`%${filters.email}%`);
		}
		if (filters.identifier && filters.identifier.toString().trim() !== "") {
			conditions.push("identifier LIKE ?");
			params.push(`%${filters.identifier}%`);
		}
		if (filters.created_on && filters.created_on.toString().trim() !== "") {
			conditions.push("DATE(created_on) = ?");
			params.push(filters.created_on);
		}
		if (filters.updated_on && filters.updated_on.toString().trim() !== "") {
			conditions.push("DATE(updated_on) = ?");
			params.push(filters.updated_on);
		}

		const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
		return { whereClause, params };
	}

	public async insertCliniciansBulk(tenantId: number, clinicians: Array<Partial<PrimeLimsTableclinicianbasicinfo>>): Promise<Array<number | string>> {
		const results: Array<number | string> = [];
		const connection = await KnexConnection(tenantId);
		for (const record of clinicians) {
			const { name, phone, email, location, address, occupation, organization } = record;
			if (!name || !phone) {
				results.push("Missing required fields: name or phone");
				continue;
			}
			try {
				const values = [name, phone, email ? email : null, location, address, occupation, organization];
				const trx = await connection.transaction();
				try {
					const [result] = await trx.raw(SQLQueries.insertClinicianBasicInfo, values);
					const insertId = result?.insertId || result?.[0]?.insertId;
					if (insertId !== 0 && insertId !== undefined) {
						const row = await trx("clinicianbasicinfo").select("identifier").where({ id: insertId }).first();
						const identifier = row?.identifier ? String(row.identifier) : "";
						await applyClinicianAfterInsert(tenantId, trx, { clinicianid: Number(insertId), identifier });
						await trx.commit();
						results.push(insertId);
					} else {
						await trx.rollback();
						results.push("Insert failed");
					}
				} catch (err) {
					await trx.rollback();
					results.push("Insert failed");
				}
			} catch (err: { message?: string; sqlState?: string; sqlMessage?: string } | any) {
				if (err && err.sqlState === '23000' && err.sqlMessage && err.sqlMessage.includes('Duplicate entry')) {
					results.push("Duplicate entry error: " + err.sqlMessage);
					continue;
				}
				results.push("Error: " + (err?.message || err));
			}
		}
		return results;
	}
	public async getClinicians(tenantId: number, filters: ClinicianFilterParams | null): Promise<Clinician[]> {
		const { count = 10, page = 1, role } = filters || {};

		// Check if any filters are applied
		const hasFilters = filters && Object.keys(filters).some(key =>
			key !== 'page' && key !== 'count' && key !== 'role' && filters[key as keyof ClinicianFilterParams]
		);


		// If no filters, use the original logic
		if (!hasFilters) {
			if (role && roleAllowed(role, ["admin"])) {
				return (count && page) ? await paginationQuery({ page: parseInt(page.toString()), count: parseInt(count.toString()) }, SQLQueries.getCliniciansWithExtendedPagination, [], tenantId) :
					await promisifyQuery(tenantId, SQLQueries.getAllCliniciansWithPaymentInfo);
			}
			else {
				return (count && page) ? await paginationQuery({ page: parseInt(page.toString()), count: parseInt(count.toString()) }, SQLQueries.getCliniciansWithPagination, [], tenantId) :
					await promisifyQuery(tenantId, SQLQueries.getAllClinicians);
			}
		}


		// Build filter query
		const { whereClause, params } = this.buildFilterQuery(filters);

		// Construct base query with filters
		let baseQuery = "SELECT * FROM clinicianbasicinfo" + whereClause;

		// Add payment info for admin users
		if (role && roleAllowed(role, ["admin"])) {
			baseQuery = `SELECT cbi.*, cbi.id as clinicianid,cpi.id as clinicianpaymentid, cpi.* FROM clinicianbasicinfo AS cbi
				LEFT JOIN clinicianpaymentinfo AS cpi ON cbi.id = cpi.clinicianid${whereClause}`;
		}

		// Execute query with pagination
		if (count && page) {
			const pageNum = parseInt(page.toString());
			const countNum = parseInt(count.toString());
			const offset = (pageNum - 1) * countNum;
			const paginatedQuery = baseQuery + ` LIMIT ? OFFSET ?`;
			params.push(countNum, offset);
			return await promisifyQuery(tenantId, paginatedQuery, params);
		} else {
			return await promisifyQuery(tenantId, baseQuery, params);
		}
	}

	public static getAllClinicians(tenantId: number) {
		return promisifyQuery(tenantId, SQLQueries.getAllClinicians);
	}

	public async getClinicianBasicInfo(tenantId: number, clinicianid: number): Promise<PrimeLimsTableclinicianbasicinfo[]> {
		return await promisifyQuery(tenantId, SQLQueries.getClinicianBasicInfo, [clinicianid]);
	}

	public async getClinicianBatch(tenantId: number, page: number, count: number): Promise<PrimeLimsTableclinicianbasicinfo[]> {
		return await promisifyQuery(tenantId, SQLQueries.getClinicianBatch, [count, page]);
	}

	public async putCliniciansBasic(tenantId: number,
		records: Partial<PrimeLimsTableclinicianbasicinfo> & { phone: string, email: string, id: number }): Promise<string | boolean> {
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
				const isClinicianExist = await this.isClinicianExist(tenantId, email, phone);
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
		const connection = await KnexConnection(tenantId);
		const trx = await connection.transaction();
		try {
			const deleted = await trx("clinicianbasicinfo").where({ id }).del();
			if (deleted > 0) {
				await applyClinicianAfterDelete(trx, id);
			}
			await trx.commit();
			return deleted > 0;
		} catch (err) {
			await trx.rollback();
			throw err;
		}
	}

	private async isClinicianExist(tenantId: number, email: string, mobile: string): Promise<boolean> {
		if (!email || !mobile) return false;
		const matched = await promisifyQuery(tenantId, `SELECT * FROM clinicianbasicinfo WHERE EMAIL = ? OR phone = ?`, [email, mobile]);
		return matched.length > 0 ? true : false;
	}

	public async postClinicianBasicInfo(reqbody: any): Promise<string | number> {
		const tenantIdP = parseFloat(reqbody.tenantId.toString());
		const { name, phone, email, location, address, occupation, organization } = reqbody;

		const values = [name, phone, email ? email : null, location, address, occupation, organization];
		const connection = await KnexConnection(tenantIdP);
		const trx = await connection.transaction();

		try {
			const [result] = await trx.raw(SQLQueries.insertClinicianBasicInfo, values);
			const insertId = result?.insertId || result?.[0]?.insertId;
			if (insertId !== 0 && insertId !== undefined) {
				const row = await trx("clinicianbasicinfo").select("identifier").where({ id: insertId }).first();
				const identifier = row?.identifier ? String(row.identifier) : "";
				await applyClinicianAfterInsert(tenantIdP, trx, { clinicianid: Number(insertId), identifier });
				const referralRepo = new ReferralCodingRepo(tenantIdP);
				await referralRepo.create({ entity_id: insertId, entity_type: 'clinician', code: 0 }, trx);
				await trx.commit();
				return insertId;
			} else {
				await trx.rollback();
				return "Adding new clinician failed";
			}
		} catch (err) {
			await trx.rollback();
			console.error("Error adding new clinician:", err);
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

	public async verifyClinicianPhoneNumberAndEmail(tenantId: number, email: string, phone: string) {
		const isPhoneValid = TiifuWorkingClass.isNumberPhoneNumber(phone);
		const isEmailValid = TiifuWorkingClass.isEmailValidEmail(email);

		if (!isPhoneValid) return OperationsFailures.invalidPhoneNumber;
		if (email && !isEmailValid) return OperationsFailures.invalidEmail;

		const isClinicianExist = await this.isClinicianExist(tenantId, email, phone);
		if (isClinicianExist) {
			return OperationsFailures.resourceExist + " Email or phone number is already registered with a clinician";
		}
		return true;
	}
}


