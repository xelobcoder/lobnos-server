"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsCategoryMappingsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class PrimeSmsCategoryMappingsRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = "primesmscategorymappings";
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
    async findAll() {
        const connection = await this.connection;
        return await connection(this.tablename).select();
    }
    async update(id, data) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ id }).update(data);
    }
    async delete(id) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ id }).del();
    }
    async getCategoriesWithPlaceholders() {
        try {
            // load columns for organization, clinician, and patient, put in an object format and send back
            const connection = await this.connection;
            const dbSchema = 'limsdb';
            const query = `SELECT CONCAT('{', COLUMN_NAME, '}') AS placeholder FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`;
            const categories = {
                patient: 'new_patients',
                clinician: 'clinicianbasicinfo',
                organization: 'organization'
            };
            const placeholders = {};
            for (const [category, tableName] of Object.entries(categories)) {
                const [result] = await connection.raw(query, [dbSchema, tableName]);
                placeholders[category] = (result || []).map((row) => row.placeholder);
            }
            const sensitiveColumns = {
                patient: ['password', 'refreshToken', 'accessToken'],
            };
            // remove sensitive columns from placeholders
            for (const category in placeholders) {
                placeholders[category] = placeholders[category].filter((placeholder) => {
                    var _a;
                    return !((_a = sensitiveColumns[category]) === null || _a === void 0 ? void 0 : _a.includes(placeholder.replace(/{|}/g, '')));
                });
            }
            return placeholders;
        }
        catch (err) {
            console.error('Error loading categories with placeholders:', err);
            throw err;
        }
    }
}
exports.PrimeSmsCategoryMappingsRepo = PrimeSmsCategoryMappingsRepo;
