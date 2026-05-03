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
    padDateTimePart(value) {
        return value.toString().padStart(2, "0");
    }
    formatDateTimeForMysql(value) {
        if (typeof value === "string") {
            const trimmed = value.trim();
            const isoLikeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$/);
            if (isoLikeMatch) {
                const [, datePart, timePart, secondsPart] = isoLikeMatch;
                return `${datePart} ${timePart}:${secondsPart || "00"}`;
            }
        }
        const parsed = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new Error("Invalid task datetime format");
        }
        const year = parsed.getFullYear();
        const month = this.padDateTimePart(parsed.getMonth() + 1);
        const day = this.padDateTimePart(parsed.getDate());
        const hours = this.padDateTimePart(parsed.getHours());
        const minutes = this.padDateTimePart(parsed.getMinutes());
        const seconds = this.padDateTimePart(parsed.getSeconds());
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    normalizeTaskDateFields(task) {
        const normalizedTask = Object.assign({}, task);
        if (normalizedTask.startDate !== undefined && normalizedTask.startDate !== null) {
            normalizedTask.startDate = this.formatDateTimeForMysql(normalizedTask.startDate);
        }
        if (normalizedTask.endDate !== undefined && normalizedTask.endDate !== null) {
            normalizedTask.endDate = this.formatDateTimeForMysql(normalizedTask.endDate);
        }
        return normalizedTask;
    }
    async create(tenantId, task) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const normalizedTask = this.normalizeTaskDateFields(task);
        const createdPrimeLimsTabletasks = await connection(this.tableName).insert(normalizedTask);
        console.log("Created task with ID:", createdPrimeLimsTabletasks);
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
        const normalizedUpdates = this.normalizeTaskDateFields(updates);
        const updatedPrimeLimsTabletasks = await connection(this.tableName).where({ id }).update(normalizedUpdates);
        return updatedPrimeLimsTabletasks;
    }
    async delete(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.tableName).where({ id }).del();
    }
    async list(tenantId, page, count, sortby) {
        const offset = (page - 1) * count;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.tableName)
            .leftJoin("roles", "roles.employeeid", "=", `${this.tableName}.assignedTo`)
            .select(`${this.tableName}.*`, "roles.username")
            .orderBy(`${this.tableName}.id`, sortby)
            .limit(count)
            .offset(offset);
    }
}
exports.default = PrimeLimsTabletasksService;
