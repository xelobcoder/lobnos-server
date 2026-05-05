
import { PrimeLimsTableorganization } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";
import { applyOrganizationAfterInsert } from "../../database/appLevelTriggers";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import User from "../../LobnosAuth/user";
import { ReferralCodingRepo } from "../referral/repositories/ReferralCodingRepo";
import { newOrganization, OperationsStatus, OrganizationRequestBody, OrgContactInfo, searchQueryParams } from "./OrgaInterfac";
import {
	MONTHLYSALESQUERY,
	WEEKLYSALESQUERY,
	DAILYSALESQUERY,
	TODAYSALESQUERY,
	YEARLYSALESQUERY,
	q_accountInfo,
	q_update_org_basic_info,
	q_create_an_organization,
	q_has_an_organization,
	q_update_organization_contact_info,
	q_org_payment,
	q_org_contact,
	q_updateOrg_payment_info,
	q_top_performance_organization,
	q_organizationid_is_valid,
	q_organization_total_count,
	paginated_org_data
} from "./queries";

interface OrganizationInfo {
	id: number;
	commission: number;
}

const defaultSalesParam = {
	discountedAmount: 0,
	payable: 0,
	commissionRate: 0,
	referedCases: 0,
};

class Organization {
	private organizationId: number | null;

	constructor(organizationId: number | null) {
		this.organizationId = organizationId;
	}

	async getOrganizations(tenantId: number) {
		return await promisifyQuery(tenantId, "SELECT id,name FROM organization");
	}

	async hasOrganization(tenantId: number, name: string) {
		const result = await promisifyQuery(tenantId, q_has_an_organization, [name]);
		return result[0]["count"] > 0;
	}

	async isProvidedOrganizationIdValid(tenantId: number, organizationid: number) {
		const rows = await promisifyQuery(tenantId, q_organizationid_is_valid, [organizationid]);
		return rows.length > 0;
	}


	async insertOrganizationsBulk(tenantId: number, organizations: Array<OrganizationRequestBody>): Promise<Array<number | string>> {
		const results: Array<number | string> = [];
		for (const org of organizations) {
			const { name, location, street, mobile, address, website, email, gpsMapping, region, type } = org;
			try {
				const has_organization = await this.hasOrganization(tenantId, name);
				if (has_organization) {
					results.push(`Duplicate: ${name}`);
					continue;
				}

				const validPhone = TiifuWorkingClass.isNumberPhoneNumber(mobile);
				const isValidEmail = TiifuWorkingClass.isEmailValidEmail(email);

				if (!validPhone) {
					results.push(`Invalid phone number: ${mobile}`);
					continue;
				}

				if (email && !isValidEmail) {
					results.push(`Invalid email address: ${email}`);
					continue;
				}

				const values = [
					name ?? "",
					location ?? "",
					street ?? "",
					mobile ?? "",
					address ?? "",
					website ?? "",
					email ?? "",
					gpsMapping ?? "",
					region ?? "",
					type ?? ""
				];

				if (!name) {
					results.push(`Missing required field: name`);
					continue;
				}
				const connection = await KnexConnection(tenantId);
				const trx = await connection.transaction();
				try {
					const [result] = await trx.raw(q_create_an_organization, values);
					const insertId = result?.insertId || result?.[0]?.insertId;
					if (insertId !== 0 && insertId !== undefined) {
						await applyOrganizationAfterInsert(trx, Number(insertId));
						const referralRepo = new ReferralCodingRepo(tenantId);
						await referralRepo.create({ entity_id: insertId, entity_type: 'organization', code: 0 }, trx);
						await trx.commit();
						results.push(insertId);
					} else {
						await trx.rollback();
						results.push(`Insert failed: ${name}`);
					}
				} catch (err: any) {
					await trx.rollback();
					if (err && err.sqlState === '23000' && err.sqlMessage && err.sqlMessage.includes('Duplicate entry')) {
						results.push(`Duplicate entry error: ${err.sqlMessage}`);
						continue;
					}
					results.push(`Error: ${err?.message || err}`);
				}
			} catch (err: any) {
				results.push(`Error: ${err?.message || err}`);
			}
		}
		return results;
	}

	async deleteOrganization(tenantId: number) {
		const deleted = await promisifyQuery(tenantId, `DELETE FROM organization WHERE ID = ?`, [this.organizationId]);
		return rowAffected(deleted);
	}

	async createAorganization(tenantId: number, body: OrganizationRequestBody): Promise<boolean | string> {
		const { name, location, street, mobile, address, website, email, gpsMapping, region, type } = body;
		const has_organization = await this.hasOrganization(tenantId, name);
		if (has_organization) return OperationsStatus.exist;
		const values = [name, location, street, mobile, address, website, email, gpsMapping, region, type];

		const connection = await KnexConnection(tenantId);
		const trx = await connection.transaction();
		try {
			const [result] = await trx('organization').insert({
				name,
				location: location || null,
				street: street || null,
				mobile,
				address: address || null,
				website: website || null,
				email: email || null,
				gpsmapping: gpsMapping || null,
				region: region || null,
				type: type || null
			});

			const insertId = typeof result === "number" && result > 0;

			if (insertId) {
				await applyOrganizationAfterInsert(trx, Number(result));
				const referralRepo = new ReferralCodingRepo(tenantId);
				await referralRepo.create({ entity_id: result, entity_type: 'organization', code: 0 }, trx);
				await trx.commit();
				return insertId;
			} else {
				await trx.rollback();
				return "Adding new organization failed";
			}
		} catch (err) {
			console.log(err)
			await trx.rollback();
			console.error("Error adding new organization:", err);
			return "Error adding new organization";
		}
	}

	public async getOrganizationWithDetails(tenantId: number, params: searchQueryParams) {
		let conditions = [];
		let values = [];
		let q_get_organizations = `SELECT * FROM organization`;
		const { organization, email, contact, count = 10, page = 1 } = params;
		const pageNumber = Number(page);
		const countNumber = Number(count);
		if (organization) {
			conditions.push(`name LIKE ?`);
			values.push('%' + organization + '%');
		}
		if (email) {
			conditions.push(`email LIKE ?`);
			values.push('%' + email + '%');
		}
		if (contact) {
			conditions.push(`mobile LIKE ?`);
			values.push('%' + contact + '%');
		}
		if (conditions.length !== 0) {
			q_get_organizations += ` WHERE ` + conditions.join(' AND ');
		}
		q_get_organizations += ` LIMIT ? OFFSET ?`;
		values.push(countNumber, (pageNumber - 1) * countNumber);
		const packets = await paginationQuery({ page: pageNumber, count: countNumber }, q_get_organizations, values, tenantId);
		return packets;
	}

	async getOrganizationBasic(tenantId: number) {
		if (!this.organizationId) return;
		let result = await promisifyQuery(tenantId, "SELECT * FROM organization WHERE id = ?", [this.organizationId]);
		return result;
	}

	async updateOrganizationBasic(tenantId: number, requestBody: newOrganization) {
		const { name, location, street, mobile, address, website, email, gpsMapping, region, type, id } = requestBody;

		const organization = await this.getOrganizationBasic(tenantId)
		const values = [location, street, mobile, address, website, email, gpsMapping, region, name, type, id];
		const q_packets = await promisifyQuery(tenantId, q_update_org_basic_info, values);
		return rowAffected(q_packets);
	}

	static async paginatedOrganizationInformation(tenantId: number, page: number, count: number): Promise<PrimeLimsTableorganization[]> {
		return await promisifyQuery(tenantId, paginated_org_data, [count, page])
	}

	async updateOrganizationalContactInfo(tenantId: number, requestBody: OrgContactInfo) {
		const { name, email, mobile, organizationid } = requestBody;
		if (!this.organizationId) return false;
		const values = [name, email, mobile, organizationid];
		const result = await promisifyQuery(tenantId, q_update_organization_contact_info, values);
		return rowAffected(result);
	}

	async updateOrganizationPayment(tenantId: number, requestBody: any) {
		if (!this.organizationId) throw new Error("organizational id required");
		const { bankname, momoname, branch, module, commission, account, accountname, momo } = requestBody;
		const values = [branch, commission, account, bankname, module, momoname, accountname, momo, this.organizationId];
		let result = rowAffected(await promisifyQuery(tenantId, q_updateOrg_payment_info, values));
		return result;
	}

	public async getOrganizationalPayment(tenantId: number) {
		if (!this.organizationId) {
			throw new Error('organizational id missing');
		}
		return await promisifyQuery(tenantId, q_org_payment, [this.organizationId]);
	}

	async getOrganizationContact(tenantId: number) {
		if (!this.organizationId) {
			throw new Error('organizational id missing');
		}
		const result = await promisifyQuery(tenantId, q_org_contact, [this.organizationId]);
		return result;
	}

	protected async getCommissionRate(tenantId: number): Promise<number> {
		let commissionRate = 0;
		const organizationInfo = await this.organizationAccountInfo(tenantId);
		if (organizationInfo.length !== 0 && organizationInfo[0]["commission"] !== 0) {
			commissionRate = organizationInfo[0]["commission"];
		}
		return commissionRate;
	}

	private async calculateRate<T extends { payable: string }>(tenantId: number, data: T[]) {
		const commissionRate = await this.getCommissionRate(tenantId);
		const payable = data[0]["payable"];
		const rate = parseFloat(payable) * (parseFloat(commissionRate.toString()) / 100);
		return { ...data[0], commissionRate: rate };
	}

	public async monthSales(tenantId: number): Promise<any> {
		let monthly = await promisifyQuery(tenantId, MONTHLYSALESQUERY, [this.organizationId]);
		if (monthly.length === 0) {
			return defaultSalesParam;
		}
		monthly = await this.calculateRate(tenantId, monthly);
		return monthly;
	}

	public async daySales(tenantId: number): Promise<any> {
		let result = await promisifyQuery(tenantId, TODAYSALESQUERY, [this.organizationId]);
		if (result.length === 0) {
			return defaultSalesParam;
		}
		result = await this.calculateRate(tenantId, result);
		return result;
	}

	public async weeklySales(tenantId: number): Promise<any[]> {
		const commissionRate = await this.getCommissionRate(tenantId);
		let result = await promisifyQuery(tenantId, WEEKLYSALESQUERY, [this.organizationId]);
		if (result.length === 0) {
			return [];
		}
		result = result.map((item: any) => {
			const commission = parseFloat(item?.payable) * (parseFloat(commissionRate.toString()) / 100);
			return { ...item, value: commission, name: item?.weeklySales };
		});
		return result;
	}

	public async getYearlySales(tenantId: number): Promise<any> {
		let result = await promisifyQuery(tenantId, YEARLYSALESQUERY, [this.organizationId]);
		if (result.length === 0) {
			return defaultSalesParam;
		}
		result = await this.calculateRate(tenantId, result);
		return result;
	}

	public async getDailySales(tenantId: number): Promise<any[]> {
		let result = await promisifyQuery(tenantId, DAILYSALESQUERY, [this.organizationId]);
		result = await Promise.all(result.map(async (a: any) => await this.calculateRate(tenantId, [a])));
		return result;
	}
	static async getOrganizationTotalCount(tenantId: number): Promise<number> {
		const result = await promisifyQuery(tenantId, q_organization_total_count);
		if (result.length > 0) {
			return result[0].total;
		}
		return 0;
	}

	private async organizationAccountInfo(tenantId: number): Promise<OrganizationInfo[]> {
		if (!this.organizationId) throw ReferenceError('organization ID not Provided');
		return await promisifyQuery(tenantId, q_accountInfo, [this.organizationId]);
	}

	public async getOrganizationInfo(tenantId: number): Promise<any> {
		return await promisifyQuery(tenantId, "SELECT * FROM organization WHERE id = ?", [this.organizationId]);
	}

	public async generateOrganizationalSalesReport(tenantId: number): Promise<any> {
		if (!this.organizationId) return false;
		const monthly = await this.monthSales(tenantId);
		const today = await this.daySales(tenantId);
		const weekly = await this.weeklySales(tenantId);
		const daily = await this.getDailySales(tenantId);
		const yearly = await this.getYearlySales(tenantId);
		const sales = { monthly, today, weekly, yearly, daily };
		return sales;
	}

	async getTopPerformance(tenantId: number, requestQuery: { count: number, from?: string, to?: string }): Promise<any[]> {
		const { count, from, to } = requestQuery;
		let q_query = q_top_performance_organization;
		let conditions = [];
		let parameters = [];
		if (from && to) {
			conditions.push(`pt.date BETWEEN ? AND ?`);
			parameters.push(from, to);
		} else if (from && !to) {
			conditions.push(`pt.date BETWEEN ? AND CURRENT_DATE`);
			parameters.push(from);
		}
		if (conditions.length > 0) {
			q_query += ` WHERE ${conditions.join(' AND ')}`;
		}
		q_query += `
	GROUP BY o.id, o.name
	ORDER BY TotalSales DESC
	LIMIT ?
  `;
		parameters.push(count);
		let result = await promisifyQuery(tenantId, q_query, parameters);
		return result;
	}
}

export default Organization;
