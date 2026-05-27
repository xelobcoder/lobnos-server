"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutsourcedTestTrackingRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class OutsourcedTestTrackingRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async getProfitPerTestByOutsource(outsourceid) {
        const conn = await this.connection;
        let query = conn('outsourcedtesttracking')
            .innerJoin('outsourceorganizationservices', function () {
            this.on('outsourcedtesttracking.outsourceid', '=', 'outsourceorganizationservices.outsourceid')
                .andOn('outsourcedtesttracking.testid', '=', 'outsourceorganizationservices.generalTestId');
        })
            .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
            .select('outsourcedtesttracking.testid', conn.raw('SUM(outsourceorganizationservices.outsourcePrice) as totalOutsourcePrice'), conn.raw('SUM(dboservices.totalpayable) as totalPayable'), conn.raw('SUM(outsourceorganizationservices.outsourcePrice - dboservices.totalpayable) as profit'))
            .groupBy('outsourcedtesttracking.testid');
        if (outsourceid !== undefined) {
            query = query.where('outsourcedtesttracking.outsourceid', outsourceid);
        }
        return await query;
    }
    async create(data, trx) {
        const conn = trx || await this.connection;
        if (!data.serviceid || !data.testid || !data.employeeid || !data.outsourceid) {
            throw new Error("Missing required fields: serviceid, testid, employeeid, or outsourceid");
        }
        const [id] = await conn("outsourcedtesttracking").insert({
            serviceid: data.serviceid,
            testid: data.testid,
            employeeid: data.employeeid,
            status: data.status || 0,
            comments: data.comments || '',
            createdOn: new Date(),
            updatedOn: new Date(),
            outsourceid: data.outsourceid,
            completedconfirmedby: data.completedconfirmedby || null,
        });
        return id;
    }
    async getById(id, trx) {
        const conn = trx || await this.connection;
        const row = await conn("outsourcedtesttracking").where({ id }).first();
        return row || null;
    }
    async update(id, data, trx) {
        const conn = trx || await this.connection;
        await conn("outsourcedtesttracking").where({ id }).update(data);
        return await this.getById(id, trx);
    }
    async delete(id) {
        const conn = await this.connection;
        return await conn("outsourcedtesttracking").where({ id }).del();
    }
    async list(filter = {}) {
        const conn = await this.connection;
        return await conn("outsourcedtesttracking").where(filter);
    }
    async countByStatus(status) {
        var _a;
        const conn = await this.connection;
        const result = await conn("outsourcedtesttracking")
            .where({ status })
            .count("id as count");
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) || 0;
    }
    async getByOutsourceOrg(outsourceid) {
        const conn = await this.connection;
        return await conn("outsourcedtesttracking")
            .innerJoin('outsourcedorgs', 'outsourcedtesttracking.outsourceid', 'outsourcedorgs.id')
            .select('outsourcedtesttracking.*', 'outsourcedorgs.name as outsourceOrgName')
            .where('outsourcedtesttracking.outsourceid', outsourceid)
            .orderBy('outsourcedtesttracking.createdOn', 'desc');
    }
    async getTestOutsourcedCountAndFinances() {
        const conn = await this.connection;
        return await conn("outsourcedtesttracking")
            .innerJoin('test_panels', 'outsourcedtesttracking.testid', 'test_panels.id')
            .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
            .select('outsourcedtesttracking.*', 'test_panels.name as testName', 'dboservices.totalpayable');
    }
    async getTotalAmountByTestOutsourced(outsourcedid) {
        const conn = await this.connection;
        let query = conn('outsourcedtesttracking')
            .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
            .select('outsourcedtesttracking.testid')
            .sum('dboservices.totalpayable as totalAmount');
        if (outsourcedid !== undefined) {
            query = query.where('outsourcedtesttracking.outsourceid', outsourcedid);
        }
        query = query.groupBy('outsourcedtesttracking.testid');
        return await query;
    }
    async getOursourcedTestCasesPaginated(page = 1, limit = 10, sortby = 'DESC') {
        const conn = await this.connection;
        return await conn('outsourcedtesttracking')
            .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
            .innerJoin('outsourceorganizationservices', function () {
            this.on('outsourcedtesttracking.outsourceid', '=', 'outsourceorganizationservices.outsourceid')
                .andOn('outsourcedtesttracking.testid', '=', 'outsourceorganizationservices.generalTestId');
        })
            .leftJoin("roles", "outsourcedtesttracking.employeeid", "roles.employeeid")
            .leftJoin("roles as confirmer", "outsourcedtesttracking.completedconfirmedby", "confirmer.employeeid")
            .leftJoin("test_panels", "outsourcedtesttracking.testid", "test_panels.id")
            .leftJoin('expensesrecord as er', function () {
            this.on('outsourcedtesttracking.serviceid', '=', 'er.serviceid')
                .andOn('er.isassociatedservice', '=', conn.raw('?', [1]));
        })
            .select('outsourcedtesttracking.*', 'dboservices.trackId', "dboservices.serviceAddedOn", 'dboservices.serviceCategory', 'test_panels.name as testName', 'outsourceorganizationservices.*', "roles.username as employeeName", "confirmer.username as confirmerName", conn.raw('CASE WHEN er.id IS NOT NULL THEN 1 ELSE 0 END AS is_expensed'))
            .orderBy(`outsourcedtesttracking.createdOn`, sortby)
            .limit(limit)
            .offset((page - 1) * limit);
    }
    async getProfitByOutsourcedTest(outsourceid, testid) {
        const conn = await this.connection;
        let query = conn('outsourcedtesttracking')
            .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
            .innerJoin('outsourceorganizationservices', function () {
            this.on('outsourcedtesttracking.outsourceid', '=', 'outsourceorganizationservices.outsourceid')
                .andOn('outsourcedtesttracking.testid', '=', 'outsourceorganizationservices.generalTestId');
        })
            .select('outsourcedtesttracking.id', 'outsourcedtesttracking.testid', 'outsourcedtesttracking.serviceid', 'dboservices.totalpayable', conn.raw('(dboservices.totalpayable - outsourceorganizationservices.outsourcePrice) as profit'));
        if (outsourceid !== undefined) {
            query = query.where('outsourcedtesttracking.outsourceid', outsourceid);
        }
        if (testid !== undefined) {
            query = query.where('outsourcedtesttracking.testid', testid);
        }
        return await query;
    }
}
exports.OutsourcedTestTrackingRepo = OutsourcedTestTrackingRepo;
