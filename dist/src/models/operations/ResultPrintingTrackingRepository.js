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
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .leftJoin('roles', `${this.tableName}.employeeid`, 'roles.employeeid')
                .select(`${this.tableName}.*`, 'roles.username as employee_name', 'roles.role as employee_role')
                .where(`${this.tableName}.ascensionid`, ascensionid)
                .orderBy(`${this.tableName}.actionon`, sortby)
                .limit(count)
                .offset((page - 1) * count);
        }
        catch (error) {
            logger_1.default.error('Error finding result printing tracking by ascensionid:', error);
            throw error;
        }
    }
    async findAll(page = 1, count = 20, sortby = 'DESC') {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .leftJoin('roles', `${this.tableName}.employeeid`, 'roles.employeeid')
                .select(`${this.tableName}.*`, 'roles.username as employee_name', 'roles.role as employee_role')
                .orderBy(`${this.tableName}.actionon`, sortby)
                .limit(count)
                .offset((page - 1) * count);
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
