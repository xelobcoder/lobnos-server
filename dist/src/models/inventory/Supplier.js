"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class SupplierModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    generateSupplierId() {
        const timestamp = Date.now().toString();
        return `SUP-${timestamp}`;
    }
    async create(request) {
        const connection = await this.connection;
        const supplierData = {
            id: this.generateSupplierId(),
            name: request.name,
            contact: request.contact || null,
            email: request.email || null,
            phone: request.phone || null,
            address: request.address || null,
            is_active: request.is_active !== undefined ? request.is_active : true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await connection('inv_suppliers').insert(supplierData);
        return supplierData;
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_suppliers')
            .where('id', id)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            name: result.name,
            contact: result.contact,
            email: result.email,
            phone: result.phone,
            address: result.address,
            is_active: result.is_active,
            created_at: result.created_at,
            updated_at: result.updated_at
        };
    }
    async findMany(page = 1, count = 10, search) {
        const connection = await this.connection;
        let query = connection('inv_suppliers')
            .orderBy('name', 'ASC');
        if (search) {
            query = query.where((qb) => {
                qb.where('name', 'like', `%${search}%`)
                    .orWhere('contact', 'like', `%${search}%`)
                    .orWhere('email', 'like', `%${search}%`);
            });
        }
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt((totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0);
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const suppliers = rawData.map((result) => ({
            id: result.id,
            name: result.name,
            contact: result.contact,
            email: result.email,
            phone: result.phone,
            address: result.address,
            is_active: result.is_active,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
        return {
            suppliers,
            total,
            page,
            count,
            totalPages: Math.ceil(total / count)
        };
    }
    async update(id, updates) {
        const connection = await this.connection;
        const currentSupplier = await this.findById(id);
        if (!currentSupplier) {
            throw new Error('Supplier not found');
        }
        const updateData = {
            updated_at: new Date().toISOString()
        };
        if (updates.name !== undefined)
            updateData.name = updates.name;
        if (updates.contact !== undefined)
            updateData.contact = updates.contact;
        if (updates.email !== undefined)
            updateData.email = updates.email;
        if (updates.phone !== undefined)
            updateData.phone = updates.phone;
        if (updates.address !== undefined)
            updateData.address = updates.address;
        if (updates.is_active !== undefined)
            updateData.is_active = updates.is_active;
        await connection('inv_suppliers')
            .where({ id })
            .update(updateData);
        return await this.findById(id);
    }
    async delete(id) {
        const connection = await this.connection;
        const result = await connection('inv_suppliers')
            .where({ id })
            .del();
        return result > 0;
    }
    async getAll() {
        const connection = await this.connection;
        const results = await connection('inv_suppliers')
            .where('is_active', true)
            .orderBy('name', 'ASC');
        return results.map((result) => ({
            id: result.id,
            name: result.name,
            contact: result.contact,
            email: result.email,
            phone: result.phone,
            address: result.address,
            is_active: result.is_active,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
    }
}
exports.SupplierModel = SupplierModel;
