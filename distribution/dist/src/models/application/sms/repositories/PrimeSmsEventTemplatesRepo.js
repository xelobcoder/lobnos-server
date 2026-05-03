"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsEventTemplatesRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class PrimeSmsEventTemplatesRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = "primesmseventtemplates";
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data) {
        const connection = await this.connection;
        const [id] = await connection(this.tablename).insert(data).returning('id');
        return id;
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ id }).first();
        return result || null;
    }
    async findAllByEvent(eventid) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ eventid }).select();
    }
    async findAllByTemplate(templateid) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ templateid }).select();
    }
    async update(id, data) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ id }).update(data);
    }
    async delete(id) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ id }).del();
    }
}
exports.PrimeSmsEventTemplatesRepo = PrimeSmsEventTemplatesRepo;
