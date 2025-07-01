"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesSessionRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class SalesSessionRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async canCreateSession(date, branchId) {
        try {
            const conn = await this.connection;
            const result = await conn('salessessionmanager')
                .where(conn.raw('DATE(sessiondate) = DATE (?)', [date]))
                .andWhere('branchid', branchId)
                .andWhere('sessionendedon', null)
                .first();
            return !result;
        }
        catch (error) {
            console.error('Check can create session error:', error);
            throw error;
        }
    }
    async create(sessionData) {
        try {
            const { sessiondate, branchid } = sessionData;
            const canCreate = await this.canCreateSession(sessiondate, branchid);
            if (!canCreate)
                return "Cannot create a session for the provided date. A session already exists for this date." /* OperationsFailures.cannotCreateSessionForDate */;
            const conn = await this.connection;
            const result = await conn('salessessionmanager').insert(sessionData);
            return result[0] ? true : false;
        }
        catch (error) {
            console.error('Sales session creation error:', error);
            throw error;
        }
    }
    async update(sessionId, updates) {
        try {
            const conn = await this.connection;
            return await conn('salessessionmanager')
                .where({ sessionid: sessionId })
                .update(updates);
        }
        catch (error) {
            console.error('Sales session update error:', error);
            throw error;
        }
    }
    async findById(sessionId) {
        try {
            const conn = await this.connection;
            return await conn('salessessionmanager')
                .where({ sessionid: sessionId })
                .first();
        }
        catch (error) {
            console.error('Sales session find error:', error);
            throw error;
        }
    }
    async findActiveSession(userId, branchId) {
        try {
            const conn = await this.connection;
            return await conn('salessessionmanager')
                .where({
                session_started_by: userId,
                branchid: branchId,
                sessionendedon: null
            })
                .first();
        }
        catch (error) {
            console.error('Active session find error:', error);
            throw error;
        }
    }
    async findSessionsByDateRange(startDate, endDate, branchId) {
        try {
            const conn = await this.connection;
            let query = conn('salessessionmanager')
                .where(conn.raw('DATE(sessiondate)'), '>=', startDate.toISOString().split('T')[0])
                .where(conn.raw('DATE(sessiondate)'), '<=', endDate.toISOString().split('T')[0])
                .orderBy('sessiondate', 'desc');
            if (branchId !== undefined) {
                query = query.andWhere('branchid', branchId);
            }
            return await query;
        }
        catch (error) {
            console.error('Sessions find by date range error:', error);
            throw error;
        }
    }
    async findSessionsPaginated(page = 1, limit = 20, branchId) {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;
            let countQuery = conn('salessessionmanager').count('sessionid as count');
            if (branchId !== undefined) {
                countQuery = countQuery.where('branchid', branchId);
            }
            const [total] = await countQuery;
            let dataQuery = conn('salessessionmanager as s')
                .leftJoin('roles as r1', 's.session_started_by', 'r1.employeeid')
                .leftJoin('roles as r2', 's.amountreceivedby', 'r2.employeeid')
                .leftJoin('roles as r3', 's.validatedby', 'r3.employeeid')
                .leftJoin('branch as b', 's.branchid', 'b.branchid')
                .select('s.*', 'r1.username as started_by_username', 'r2.username as received_by_username', 'r3.username as validated_by_username', 'b.name as branchname')
                .orderBy('s.sessiondate', 'desc')
                .limit(limit)
                .offset(offset);
            if (branchId !== undefined) {
                dataQuery = dataQuery.where('s.branchid', branchId);
            }
            const data = await dataQuery;
            return {
                data,
                total: Number(total.count),
                page,
                totalPages: Math.ceil(Number(total.count) / limit)
            };
        }
        catch (error) {
            console.error('Find sessions paginated error:', error);
            throw error;
        }
    }
    async endSession(sessionId, validatedby, handingoveramount) {
        try {
            const conn = await this.connection;
            return await conn('salessessionmanager')
                .where({ sessionid: sessionId })
                .update({
                sessionendedon: conn.fn.now(),
                validatedby,
                handingoveramount
            });
        }
        catch (error) {
            console.error('End session error:', error);
            throw error;
        }
    }
    async delete(sessionId) {
        try {
            const conn = await this.connection;
            return await conn('salessessionmanager')
                .where({ sessionid: sessionId })
                .delete();
        }
        catch (error) {
            console.error('Sales session delete error:', error);
            throw error;
        }
    }
    async hasActiveSessionForDate(date, branchId) {
        try {
            const conn = await this.connection;
            const [result] = await conn.raw(`
                    SELECT sessionid 
                    FROM salessessionmanager 
                    WHERE DATE(sessiondate) >= DATE(?)
                    AND branchid = ? 
                    AND sessionendedon IS NULL 
                    LIMIT 1
               `, [date, branchId]);
            return result.length > 0;
        }
        catch (error) {
            console.error('Check active session for date error:', error);
            throw error;
        }
    }
}
exports.SalesSessionRepo = SalesSessionRepo;
