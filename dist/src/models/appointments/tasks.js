"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class PrimeLimsTabletasksService {
    constructor(tableName) {
        this.tableName = tableName;
    }
    async create(tenantId, task) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const createdPrimeLimsTabletasks = await connection(this.tableName).insert(task);
        return createdPrimeLimsTabletasks[0];
    }
    async read(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.tableName)
            .innerJoin("roles", "roles.employeeid", "=", `${this.tableName}.assignedTo`)
            .select(`${this.tableName}.*`, "roles.username")
            .where({ id })
            .first();
    }
    async update(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updatedPrimeLimsTabletasks = await connection(this.tableName).where({ id }).update(updates);
        return updatedPrimeLimsTabletasks;
    }
    async delete(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.tableName).where({ id }).del();
    }
    async list(tenantId, page, count) {
        const offset = (page - 1) * count;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.tableName)
            .innerJoin("roles", "roles.employeeid", "=", `${this.tableName}.assignedTo`)
            .select(`${this.tableName}.*`, "roles.username")
            .orderBy(`${this.tableName}.id`, "desc")
            .limit(count)
            .offset(offset);
    }
}
exports.default = PrimeLimsTabletasksService;
