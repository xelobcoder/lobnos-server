"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const helper_1 = require("../../hooks/helper");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const ReferralCodingRepo_1 = require("../referral/repositories/ReferralCodingRepo");
const queries_1 = require("./queries");
const defaultSalesParam = {
    discountedAmount: 0,
    payable: 0,
    commissionRate: 0,
    referedCases: 0,
};
class Organization {
    constructor(organizationId) {
        this.organizationId = organizationId;
    }
    async getOrganizations(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, "SELECT id,name FROM organization");
    }
    async hasOrganization(tenantId, name) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_has_an_organization, [name]);
        return result[0]["count"] > 0;
    }
    async isProvidedOrganizationIdValid(tenantId, organizationid) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_organizationid_is_valid, [organizationid]);
        return rows.length > 0;
    }
    async insertOrganizationsBulk(tenantId, organizations) {
        var _a;
        const results = [];
        for (const org of organizations) {
            const { name, location, street, mobile, address, website, email, gpsMapping, region, type } = org;
            try {
                const has_organization = await this.hasOrganization(tenantId, name);
                if (has_organization) {
                    results.push(`Duplicate: ${name}`);
                    continue;
                }
                const validPhone = TiifuWorkingClass_1.TiifuWorkingClass.isNumberPhoneNumber(mobile);
                const isValidEmail = TiifuWorkingClass_1.TiifuWorkingClass.isEmailValidEmail(email);
                if (!validPhone) {
                    results.push(`Invalid phone number: ${mobile}`);
                    continue;
                }
                if (email && !isValidEmail) {
                    results.push(`Invalid email address: ${email}`);
                    continue;
                }
                const values = [
                    name !== null && name !== void 0 ? name : "",
                    location !== null && location !== void 0 ? location : "",
                    street !== null && street !== void 0 ? street : "",
                    mobile !== null && mobile !== void 0 ? mobile : "",
                    address !== null && address !== void 0 ? address : "",
                    website !== null && website !== void 0 ? website : "",
                    email !== null && email !== void 0 ? email : "",
                    gpsMapping !== null && gpsMapping !== void 0 ? gpsMapping : "",
                    region !== null && region !== void 0 ? region : "",
                    type !== null && type !== void 0 ? type : ""
                ];
                if (!name) {
                    results.push(`Missing required field: name`);
                    continue;
                }
                const connection = await (0, KnexConnections_1.default)(tenantId);
                const trx = await connection.transaction();
                try {
                    const [result] = await trx.raw(queries_1.q_create_an_organization, values);
                    const insertId = (result === null || result === void 0 ? void 0 : result.insertId) || ((_a = result === null || result === void 0 ? void 0 : result[0]) === null || _a === void 0 ? void 0 : _a.insertId);
                    if (insertId !== 0 && insertId !== undefined) {
                        const referralRepo = new ReferralCodingRepo_1.ReferralCodingRepo(tenantId);
                        await referralRepo.create({ entity_id: insertId, entity_type: 'organization', code: 0 }, trx);
                        await trx.commit();
                        results.push(insertId);
                    }
                    else {
                        await trx.rollback();
                        results.push(`Insert failed: ${name}`);
                    }
                }
                catch (err) {
                    await trx.rollback();
                    if (err && err.sqlState === '23000' && err.sqlMessage && err.sqlMessage.includes('Duplicate entry')) {
                        results.push(`Duplicate entry error: ${err.sqlMessage}`);
                        continue;
                    }
                    results.push(`Error: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                }
            }
            catch (err) {
                results.push(`Error: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
            }
        }
        return results;
    }
    async deleteOrganization(tenantId, employeeid, isPasswordConfirmed) {
        if (!this.organizationId || !employeeid || !isPasswordConfirmed)
            throw new Error("invalid arguments provided");
        const users = new user_1.default(null, null, null, null, null);
        const userid = parseInt(employeeid.toString());
        const user_exist = await users.userExistWithId(tenantId, userid);
        if (!user_exist)
            return "user with such credentials do not exist in our records" /* OperationsStatus.userNotFound */;
        const isAuthorized = await users.getUserRole(tenantId, userid);
        const isAuthorizedPersonel = ['admin', 'manager'];
        if (!isAuthorizedPersonel.includes(isAuthorized))
            return "Unauthorized to carry order" /* OperationsStatus.unAuthorized */;
        if (isPasswordConfirmed) {
            const deleted = await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM organization WHERE ID = ?`, [this.organizationId]);
            return (0, helper_1.rowAffected)(deleted);
        }
    }
    async createAorganization(tenantId, body) {
        const { name, location, street, mobile, address, website, email, gpsMapping, region, type } = body;
        const has_organization = await this.hasOrganization(tenantId, name);
        if (has_organization)
            return "organization with such name exist" /* OperationsStatus.exist */;
        const values = [name, location, street, mobile, address, website, email, gpsMapping, region, type];
        const connection = await (0, KnexConnections_1.default)(tenantId);
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
            const insertId = typeof result === "number" && result > 7;
            if (insertId) {
                const referralRepo = new ReferralCodingRepo_1.ReferralCodingRepo(tenantId);
                await referralRepo.create({ entity_id: result, entity_type: 'organization', code: 0 }, trx);
                await trx.commit();
                return insertId;
            }
            else {
                await trx.rollback();
                return "Adding new organization failed";
            }
        }
        catch (err) {
            await trx.rollback();
            console.error("Error adding new organization:", err);
            return "Error adding new organization";
        }
    }
    async getOrganizationWithDetails(tenantId, params) {
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
        const packets = await (0, helper_1.paginationQuery)({ page: pageNumber, count: countNumber }, q_get_organizations, values, tenantId);
        return packets;
    }
    async getOrganizationBasic(tenantId) {
        if (!this.organizationId)
            return;
        let result = await (0, helper_1.promisifyQuery)(tenantId, "SELECT * FROM organization WHERE id = ?", [this.organizationId]);
        return result;
    }
    async updateOrganizationBasic(tenantId, requestBody) {
        const { name, location, street, mobile, address, website, email, gpsMapping, region, type, id } = requestBody;
        const values = [location, street, mobile, address, website, email, gpsMapping, region, name, type, id];
        const q_packets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_org_basic_info, values);
        return (0, helper_1.rowAffected)(q_packets);
    }
    static async paginatedOrganizationInformation(tenantId, page, count) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.paginated_org_data, [count, page]);
    }
    async updateOrganizationalContactInfo(tenantId, requestBody) {
        const { name, email, mobile, organizationid } = requestBody;
        if (!this.organizationId)
            return false;
        const values = [name, email, mobile, organizationid];
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_organization_contact_info, values);
        return (0, helper_1.rowAffected)(result);
    }
    async updateOrganizationPayment(tenantId, requestBody) {
        if (!this.organizationId)
            throw new Error("organizational id required");
        const { bankname, momoname, branch, module, commission, account, accountname, momo } = requestBody;
        const values = [branch, commission, account, bankname, module, momoname, accountname, momo, this.organizationId];
        let result = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_updateOrg_payment_info, values));
        return result;
    }
    async getOrganizationalPayment(tenantId) {
        if (!this.organizationId) {
            throw new Error('organizational id missing');
        }
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_org_payment, [this.organizationId]);
    }
    async getOrganizationContact(tenantId) {
        if (!this.organizationId) {
            throw new Error('organizational id missing');
        }
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_org_contact, [this.organizationId]);
        return result;
    }
    async getCommissionRate(tenantId) {
        let commissionRate = 0;
        const organizationInfo = await this.organizationAccountInfo(tenantId);
        if (organizationInfo.length !== 0 && organizationInfo[0]["commission"] !== 0) {
            commissionRate = organizationInfo[0]["commission"];
        }
        return commissionRate;
    }
    async calculateRate(tenantId, data) {
        const commissionRate = await this.getCommissionRate(tenantId);
        const payable = data[0]["payable"];
        const rate = parseFloat(payable) * (parseFloat(commissionRate.toString()) / 100);
        return Object.assign(Object.assign({}, data[0]), { commissionRate: rate });
    }
    async monthSales(tenantId) {
        let monthly = await (0, helper_1.promisifyQuery)(tenantId, queries_1.MONTHLYSALESQUERY, [this.organizationId]);
        if (monthly.length === 0) {
            return defaultSalesParam;
        }
        monthly = await this.calculateRate(tenantId, monthly);
        return monthly;
    }
    async daySales(tenantId) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.TODAYSALESQUERY, [this.organizationId]);
        if (result.length === 0) {
            return defaultSalesParam;
        }
        result = await this.calculateRate(tenantId, result);
        return result;
    }
    async weeklySales(tenantId) {
        const commissionRate = await this.getCommissionRate(tenantId);
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.WEEKLYSALESQUERY, [this.organizationId]);
        if (result.length === 0) {
            return [];
        }
        result = result.map((item) => {
            const commission = parseFloat(item === null || item === void 0 ? void 0 : item.payable) * (parseFloat(commissionRate.toString()) / 100);
            return Object.assign(Object.assign({}, item), { value: commission, name: item === null || item === void 0 ? void 0 : item.weeklySales });
        });
        return result;
    }
    async getYearlySales(tenantId) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.YEARLYSALESQUERY, [this.organizationId]);
        if (result.length === 0) {
            return defaultSalesParam;
        }
        result = await this.calculateRate(tenantId, result);
        return result;
    }
    async getDailySales(tenantId) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.DAILYSALESQUERY, [this.organizationId]);
        result = await Promise.all(result.map(async (a) => await this.calculateRate(tenantId, [a])));
        return result;
    }
    static async getOrganizationTotalCount(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_organization_total_count);
        if (result.length > 0) {
            return result[0].total;
        }
        return 0;
    }
    async organizationAccountInfo(tenantId) {
        if (!this.organizationId)
            throw ReferenceError('organization ID not Provided');
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_accountInfo, [this.organizationId]);
    }
    async getOrganizationInfo(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, "SELECT * FROM organization WHERE id = ?", [this.organizationId]);
    }
    async generateOrganizationalSalesReport(tenantId) {
        if (!this.organizationId)
            return false;
        const monthly = await this.monthSales(tenantId);
        const today = await this.daySales(tenantId);
        const weekly = await this.weeklySales(tenantId);
        const daily = await this.getDailySales(tenantId);
        const yearly = await this.getYearlySales(tenantId);
        const sales = { monthly, today, weekly, yearly, daily };
        return sales;
    }
    async getTopPerformance(tenantId, requestQuery) {
        const { count, from, to } = requestQuery;
        let q_query = queries_1.q_top_performance_organization;
        let conditions = [];
        let parameters = [];
        if (from && to) {
            conditions.push(`pt.date BETWEEN ? AND ?`);
            parameters.push(from, to);
        }
        else if (from && !to) {
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
        let result = await (0, helper_1.promisifyQuery)(tenantId, q_query, parameters);
        return result;
    }
}
exports.default = Organization;
