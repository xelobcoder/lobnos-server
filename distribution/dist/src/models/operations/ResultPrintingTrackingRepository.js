"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
class ResultPrintingTrackingRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tableName = 'resultprintingtracking';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(entry) {
        try {
            if (entry.action !== 'view' && entry.action !== 'printed') {
                throw new Error('Invalid action. Only "view" or "printed" are allowed.');
            }
            if (typeof entry.ascensionid !== 'number' || typeof entry.employeeid !== 'number') {
                throw new Error('ascensionid and employeeid must be numbers.');
            }
            const conn = await this.connection;
            const filteredEntry = {
                ascensionid: entry.ascensionid,
                employeeid: entry.employeeid,
                action: entry.action,
                actionon: conn.fn.now()
            };
            const [id] = await conn(this.tableName).insert(filteredEntry);
            return id;
        }
        catch (error) {
            logger_1.default.error('Error creating result printing tracking entry:', error);
            throw error;
        }
    }
    async countByActionAndUser(ascensionid, employeeid, action) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tableName)
                .where({ ascensionid, employeeid, action })
                .count('trackid as count');
            return result && result[0] ? Number(result[0].count) : 0;
        }
        catch (error) {
            logger_1.default.error('Error counting result printing tracking entries:', error);
            throw error;
        }
    }
    async findAllByAscensionId(ascensionid, page = 1, count = 20, sortby = 'DESC') {
        var _a;
        try {
            const conn = await this.connection;
            const totalResult = await conn(this.tableName)
                .where(`${this.tableName}.ascensionid`, ascensionid)
                .count(`${this.tableName}.trackid as total`);
            const total = Number(((_a = totalResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0);
            const totalPages = Math.ceil(total / count);
            const data = await conn(this.tableName)
                .leftJoin('roles', `${this.tableName}.employeeid`, 'roles.employeeid')
                .leftJoin('test_ascension', `${this.tableName}.ascensionid`, 'test_ascension.id')
                .leftJoin('test_panels', 'test_ascension.testid', 'test_panels.id')
                .select(`${this.tableName}.*`, 'roles.username as employee_name', 'roles.role as employee_role', 'test_panels.name as test_name', 'test_panels.shorttext as test_shorttext', 'test_panels.category as test_category', 'test_ascension.testid as test_id')
                .where(`${this.tableName}.ascensionid`, ascensionid)
                .orderBy(`${this.tableName}.actionon`, sortby)
                .limit(count)
                .offset((page - 1) * count);
            return {
                data,
                pagination: {
                    page,
                    count,
                    total,
                    totalPages
                }
            };
        }
        catch (error) {
            logger_1.default.error('Error finding result printing tracking by ascensionid:', error);
            throw error;
        }
    }
    async findAll(page = 1, count = 20, sortby = 'DESC') {
        var _a;
        try {
            const conn = await this.connection;
            // Get total count
            const totalResult = await conn(this.tableName)
                .count(`${this.tableName}.trackid as total`);
            const total = Number(((_a = totalResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0);
            const totalPages = Math.ceil(total / count);
            // Get paginated data
            const data = await conn(this.tableName)
                .leftJoin('roles', `${this.tableName}.employeeid`, 'roles.employeeid')
                .leftJoin('test_ascension', `${this.tableName}.ascensionid`, 'test_ascension.id')
                .leftJoin('test_panels', 'test_ascension.testid', 'test_panels.id')
                .select(`${this.tableName}.*`, 'roles.username as employee_name', 'roles.role as employee_role', 'test_panels.name as test_name', 'test_panels.shorttext as test_shorttext', 'test_panels.category as test_category', 'test_ascension.testid as test_id')
                .orderBy(`${this.tableName}.actionon`, sortby)
                .limit(count)
                .offset((page - 1) * count);
            return {
                data,
                pagination: {
                    page,
                    count,
                    total,
                    totalPages
                }
            };
        }
        catch (error) {
            logger_1.default.error('Error fetching all result printing tracking entries:', error);
            throw error;
        }
    }
    async delete(trackid) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName).where({ trackid }).delete();
        }
        catch (error) {
            logger_1.default.error('Error deleting result printing tracking entry:', error);
            throw error;
        }
    }
}
exports.default = ResultPrintingTrackingRepository;
