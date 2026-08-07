"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = __importDefault(require("zod"));
class FieldConstraintsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
        this.tablename = 'field_contraints';
    }
    validateFieldContraintsDataForCreation(constraints) {
        const constraintSchema = zod_1.default.object({
            testid: zod_1.default.number().int().positive(),
            fieldid: zod_1.default.number().int().positive(),
            action: zod_1.default.enum(["none", "alert", "ignore", "replace", "lock-result"]),
            constraint_type: zod_1.default.enum(["null", "less", "greater", "match", "notmatch", "between", "contains"]),
            replacement_text: zod_1.default.string().optional().nullable(),
            value: zod_1.default.string().max(255).optional(),
            prefix: zod_1.default.string().max(255).optional(),
            suffix: zod_1.default.string().max(255).optional(),
        });
        return zod_1.default.array(constraintSchema).safeParse(constraints).success;
    }
    async create(constraints) {
        try {
            const validationResult = this.validateFieldContraintsDataForCreation(constraints);
            if (!validationResult) {
                throw new Error("Invalid field constraints data");
            }
            const conn = await this.connection;
            const result = await conn(this.tablename)
                .insert(constraints)
                .onConflict(['testid', 'fieldid', 'constraint_type', 'value', 'action'])
                .merge()
                .returning('id');
            return result.map((row) => row.id);
        }
        catch (error) {
            throw error;
        }
    }
    async findByFieldId(fieldId) {
        try {
            const conn = await this.connection;
            return await conn(this.tablename).where('fieldid', fieldId);
        }
        catch (error) {
            throw error;
        }
    }
    async findByTestId(testId) {
        try {
            const conn = await this.connection;
            return await conn(this.tablename).where('testid', testId);
        }
        catch (error) {
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tablename)
                .where('id', id)
                .update(updates);
            return result > 0;
        }
        catch (error) {
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tablename)
                .where('id', id)
                .delete();
            return result > 0;
        }
        catch (error) {
            throw error;
        }
    }
    async deleteByFieldId(fieldId) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tablename)
                .where('fieldid', fieldId)
                .delete();
            return result > 0;
        }
        catch (error) {
            throw error;
        }
    }
    async deleteByTestId(testId) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tablename)
                .where('testid', testId)
                .delete();
            return result > 0;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.default = FieldConstraintsRepository;
