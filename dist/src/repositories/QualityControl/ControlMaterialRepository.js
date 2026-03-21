"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlMaterialRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class ControlMaterialRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(materialData) {
        try {
            const conn = await this.connection;
            const [id] = await conn('control_materials')
                .insert(materialData);
            return id;
        }
        catch (error) {
            console.error('Control material creation error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            const result = await conn('control_materials')
                .where({ id })
                .update(updates);
            return result > 0;
        }
        catch (error) {
            console.error('Control material update error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ id })
                .first();
        }
        catch (error) {
            console.error('Control material find error:', error);
            throw error;
        }
    }
    async findByStatus(status) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ status })
                .orderBy('expiryDate', 'asc');
        }
        catch (error) {
            console.error('Control material find by status error:', error);
            throw error;
        }
    }
    async findByExpiryDate(date) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where('expiryDate', '<=', date)
                .where('status', 'active')
                .orderBy('expiryDate', 'asc');
        }
        catch (error) {
            console.error('Control material find by expiry date error:', error);
            throw error;
        }
    }
    async findByDeviceId(deviceId) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ deviceId })
                .orderBy('createdAt', 'desc');
        }
        catch (error) {
            console.error('Control material find by device error:', error);
            throw error;
        }
    }
    async findByTestId(testId) {
        try {
            const conn = await this.connection;
            const currentDate = new Date();
            const materials = await conn('control_materials')
                .where({ testId })
                .orderBy('createdAt', 'desc');
            return materials.map((material) => {
                const expiryDate = new Date(material.expiryDate);
                const daysUntilExpiry = Math.ceil((expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                return Object.assign(Object.assign({}, material), { isExpired: daysUntilExpiry <= 0, daysUntilExpiry });
            });
        }
        catch (error) {
            console.error('Control material find by test error:', error);
            throw error;
        }
    }
    async findActiveByTestId(testId) {
        try {
            const conn = await this.connection;
            const currentDate = new Date().toISOString();
            return await conn('control_materials')
                .where({
                testId,
                status: 'active'
            })
                .where('expiryDate', '>', currentDate)
                .orderBy('expiryDate', 'asc');
        }
        catch (error) {
            console.error('Control material find active by test error:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, limit = 10) {
        try {
            const conn = await this.connection;
            const currentDate = new Date();
            const offset = (page - 1) * limit;
            const [total] = await conn('control_materials')
                .count('control_materials.id as count');
            const rawData = await conn('control_materials')
                .leftJoin('devices', 'control_materials.deviceId', 'devices.id')
                .leftJoin('test_panels', 'control_materials.testId', 'test_panels.id')
                .leftJoin('roles', 'roles.employeeid', 'control_materials.createdby')
                .select('control_materials.*', 'devices.deviceName', 'devices.model', 'devices.manufacturer as deviceManufacturer', 'devices.serialNumber', 'devices.location', 'test_panels.name as testPanelName', 'roles.username as createdByUser')
                .orderBy('control_materials.createdAt', 'desc')
                .limit(limit)
                .offset(offset);
            const data = rawData.map((material) => {
                const expiryDate = new Date(material.expiryDate);
                const daysUntilExpiry = Math.ceil((expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                return Object.assign(Object.assign({}, material), { currentStatus: daysUntilExpiry <= 0 ? 'expired' : material.status, daysUntilExpiry });
            });
            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / limit)
            };
        }
        catch (error) {
            console.error('Control material paginated find error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ id })
                .delete();
        }
        catch (error) {
            console.error('Control material delete error:', error);
            throw error;
        }
    }
    async searchByName(searchTerm) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where('name', 'like', `%${searchTerm}%`)
                .orderBy('name', 'asc');
        }
        catch (error) {
            console.error('Control material search by name error:', error);
            throw error;
        }
    }
}
exports.ControlMaterialRepository = ControlMaterialRepository;
exports.default = ControlMaterialRepository;
