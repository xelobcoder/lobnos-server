"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TABLE_NAME = 'samplecontainer';
class SampleContainerRepository {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(containerData) {
        const conn = await this.connection;
        const result = await conn(TABLE_NAME).insert(containerData);
        return result[0];
    }
    async findAll(limit = 10, offset = 0) {
        const conn = await this.connection;
        return await conn(TABLE_NAME)
            .select('*')
            .limit(limit)
            .offset(offset);
    }
    async findById(id) {
        const conn = await this.connection;
        return conn(TABLE_NAME).where({ id }).first();
    }
    async findByName(name) {
        const conn = await this.connection;
        return conn(TABLE_NAME).where({ name }).first();
    }
    async update(id, containerData) {
        const conn = await this.connection;
        return conn(TABLE_NAME)
            .where({ id })
            .update(Object.assign(Object.assign({}, containerData), { updated_at: conn.fn.now() }));
    }
    async delete(id) {
        const conn = await this.connection;
        return conn(TABLE_NAME).where({ id }).del();
    }
    async findReusableContainers() {
        const conn = await this.connection;
        return conn(TABLE_NAME).where({ is_reusable: true });
    }
    async findByMaterial(material) {
        const conn = await this.connection;
        return conn(TABLE_NAME).where({ material });
    }
}
exports.default = SampleContainerRepository;
