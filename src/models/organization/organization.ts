
import { PrimeLimsTableorganization } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";
import { applyOrganizationAfterInsert } from "../../database/appLevelTriggers";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import { ReferralCodingRepo } from "../referral/repositories/ReferralCodingRepo";
import { assertOrganizationIdentity, lockOrganizationDirectory, OrganizationIdentityConflict, organizationEmail, organizationPhone } from './OrganizationIdentity';
import { newOrganization, OperationsStatus, OrganizationRequestBody, OrgContactInfo, searchQueryParams } from "./OrgaInterfac";
import {
	q_accountInfo,
	q_update_org_basic_info,
	q_create_an_organization,
	q_has_an_organization,
	q_update_organization_contact_info,
	q_org_payment,
	q_org_contact,
	q_updateOrg_payment_info,
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
					await lockOrganizationDirectory(trx);
					await assertOrganizationIdentity(trx, org);
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
			await lockOrganizationDirectory(trx);
			await assertOrganizationIdentity(trx, body);
			const [result] = await trx('organization').insert({
				name,
				location: location || null,
				street: street || null,
				mobile: organizationPhone(mobile) || null,
				address: address || null,
				website: website || null,
				email: organizationEmail(email) || null,
				gpsmapping: gpsMapping || (body as any).gpsmapping || null,
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
			if (err instanceof OrganizationIdentityConflict) throw err;
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

		const connection = await KnexConnection(tenantId);
		return connection.transaction(async trx => {
			await lockOrganizationDirectory(trx);
			const current = await trx('organization').where({id: this.organizationId}).forUpdate().first();
			if (!current) return false;
			const next = {...current, ...requestBody};
			await assertOrganizationIdentity(trx, next, Number(this.organizationId));
			await trx('organization').where({id: this.organizationId}).update({
				name: next.name, location: next.location, street: next.street, mobile: organizationPhone(next.mobile) || null,
				address: next.address, website: next.website, email: organizationEmail(next.email) || null,
				gpsmapping: requestBody.gpsMapping ?? next.gpsmapping, region: next.region, type: next.type
			});
			return true;
		});
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

}

export default Organization;
