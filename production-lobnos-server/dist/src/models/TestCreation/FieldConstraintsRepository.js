"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class FieldConstraintsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(constraints) {
        try {
            const conn = await this.connection;
            const result = await conn('field_constraints')
                .insert(constraints)
                .onConflict(['testid', 'fieldid', 'constraint_type', 'value', 'action'])
                .merge()
                .returning('id');
            return result.map(r => r.id);
        }
        catch (error) {
            console.error('Field constraints creation error:', error);
            throw error;
        }
    }
    async findByFieldId(fieldId) {
        try {
            const conn = await this.connection;
            return await conn('field_constraints').where('fieldid', fieldId);
        }
        catch (error) {
            console.error('Field constraints find error:', error);
            throw error;
        }
    }
    async findByTestId(testId) {
        try {
            const conn = await this.connection;
            return await conn('field_constraints').where('testid', testId);
        }
        catch (error) {
            console.error('Field constraints find by test error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            const result = await conn('field_constraints')
                .where('id', id)
                .update(updates);
            return result > 0;
        }
        catch (error) {
            console.error('Field constraints update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            const result = await conn('field_constraints')
                .where('id', id)
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('Field constraints delete error:', error);
            throw error;
        }
    }
    async deleteByFieldId(fieldId) {
        try {
            const conn = await this.connection;
            const result = await conn('field_constraints')
                .where('fieldid', fieldId)
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('Field constraints delete by field error:', error);
            throw error;
        }
    }
    async deleteByTestId(testId) {
        try {
            const conn = await this.connection;
            const result = await conn('field_constraints')
                .where('testid', testId)
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('Field constraints delete by test error:', error);
            throw error;
        }
    }
}
exports.default = FieldConstraintsRepository;
