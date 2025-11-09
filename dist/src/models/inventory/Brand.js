"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class BrandModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    generateBrandId() {
        const timestamp = Date.now().toString();
        return `BRD-${timestamp}`;
    }
    async create(request) {
        const connection = await this.connection;
        // Check if brand name already exists
        const existing = await connection('inv_brands')
            .where('name', request.name)
            .first();
        if (existing) {
            throw new Error('Brand name already exists');
        }
        const brandData = {
            id: this.generateBrandId(),
            name: request.name,
            created_date: new Date().toISOString(),
            item_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await connection('inv_brands').insert(brandData);
        return {
            id: brandData.id,
            name: brandData.name,
            created_date: brandData.created_date,
            item_count: brandData.item_count,
            created_at: brandData.created_at,
            updated_at: brandData.updated_at
        };
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_brands')
            .where('id', id)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            name: result.name,
            created_date: result.created_date,
            item_count: result.item_count,
            created_at: result.created_at,
            updated_at: result.updated_at
        };
    }
    async findByName(name) {
        const connection = await this.connection;
        const result = await connection('inv_brands')
            .where('name', name)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            name: result.name,
            created_date: result.created_date,
            item_count: result.item_count,
            created_at: result.created_at,
            updated_at: result.updated_at
        };
    }
    async findMany(page = 1, count = 10, search) {
        const connection = await this.connection;
        let query = connection('inv_brands')
            .orderBy('name', 'ASC');
        if (search) {
            query = query.where('name', 'like', `%${search}%`);
        }
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const brands = rawData.map((result) => ({
            id: result.id,
            name: result.name,
            created_date: result.created_date,
            item_count: result.item_count,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
        return {
            brands,
            total,
            page,
            count,
            totalPages: Math.ceil(total / count)
        };
    }
    async update(id, updates) {
        const connection = await this.connection;
        const currentBrand = await this.findById(id);
        if (!currentBrand) {
            throw new Error('Brand not found');
        }
        if (updates.name && updates.name !== currentBrand.name) {
            // Check if new name already exists
            const existing = await connection('inv_brands')
                .where('name', updates.name)
                .whereNot('id', id)
                .first();
            if (existing) {
                throw new Error('Brand name already exists');
            }
        }
        const updateData = {
            updated_at: new Date().toISOString()
        };
        if (updates.name !== undefined)
            updateData.name = updates.name;
        await connection('inv_brands')
            .where({ id })
            .update(updateData);
        return await this.findById(id);
    }
    async delete(id) {
        const connection = await this.connection;
        // Check if brand is in use
        const brand = await this.findById(id);
        if (!brand) {
            return false;
        }
        if (brand.item_count > 0) {
            throw new Error('Cannot delete brand in use');
        }
        const result = await connection('inv_brands')
            .where({ id })
            .del();
        return result > 0;
    }
    async bulkCreate(brands) {
        const connection = await this.connection;
        const createdBrands = [];
        const errors = [];
        for (const brandRequest of brands) {
            try {
                const brand = await this.create(brandRequest);
                createdBrands.push(brand);
            }
            catch (error) {
                errors.push({
                    name: brandRequest.name,
                    error: error.message || 'Unknown error'
                });
            }
        }
        return {
            success: errors.length === 0,
            brands: createdBrands,
            errors
        };
    }
    async getAll() {
        const connection = await this.connection;
        const results = await connection('inv_brands')
            .orderBy('name', 'ASC');
        return results.map((result) => ({
            id: result.id,
            name: result.name,
            created_date: result.created_date,
            item_count: result.item_count,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
    }
    async getStats() {
        const connection = await this.connection;
        const totalBrands = await connection('inv_brands').count('* as count').first();
        const totalItems = await connection('inv_brands').sum('item_count as total').first();
        const totalBrandsCount = parseInt(totalBrands === null || totalBrands === void 0 ? void 0 : totalBrands.count) || 0;
        const totalItemsCount = parseInt(totalItems === null || totalItems === void 0 ? void 0 : totalItems.total) || 0;
        const averageItemsPerBrand = totalBrandsCount > 0 ? totalItemsCount / totalBrandsCount : 0;
        return {
            total_brands: totalBrandsCount,
            total_items: totalItemsCount,
            average_items_per_brand: Math.round(averageItemsPerBrand * 100) / 100
        };
    }
}
exports.BrandModel = BrandModel;
