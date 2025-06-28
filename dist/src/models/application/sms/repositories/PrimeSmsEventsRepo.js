"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsEventsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class PrimeSmsEventsRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = "primesmsevents";
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data) {
        const connection = await this.connection;
        const [id] = await connection(this.tablename).insert(data).returning('eventid');
        return id;
    }
    async findById(eventid) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ eventid }).first();
        return result || null;
    }
    async findAll() {
        const connection = await this.connection;
        return await connection(this.tablename).select();
    }
    async update(eventid, data) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ eventid }).update(data);
    }
    async delete(eventid) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ eventid }).del();
    }
}
exports.PrimeSmsEventsRepo = PrimeSmsEventsRepo;
