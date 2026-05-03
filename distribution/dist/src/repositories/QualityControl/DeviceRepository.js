"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const uuid_1 = require("uuid");
class DeviceRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(deviceData) {
        try {
            const conn = await this.connection;
            const id = (0, uuid_1.v4)();
            const result = await conn('devices')
                .insert(Object.assign(Object.assign({}, deviceData), { id, updatedby: deviceData.createdby }));
            return result[0];
        }
        catch (error) {
            console.error('Device creation error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ id })
                .update(updates);
        }
        catch (error) {
            console.error('Device update error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ id })
                .first();
        }
        catch (error) {
            console.error('Device find error:', error);
            throw error;
        }
    }
    async findByStatus(status) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ status })
                .orderBy('nextCalibrationDate', 'asc');
        }
        catch (error) {
            console.error('Device find by status error:', error);
            throw error;
        }
    }
    async findByCalibrationDue(date) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where('nextCalibrationDate', '<=', date)
                .where('status', 'active')
                .orderBy('nextCalibrationDate', 'asc');
        }
        catch (error) {
            console.error('Device find by calibration due error:', error);
            throw error;
        }
    }
    async findAllPaginated(page, count) {
        try {
            const conn = await this.connection;
            const [total] = await conn('devices').count('id as count');
            if (!page || !count) {
                const data = await conn('devices')
                    .orderBy('createdAt', 'desc');
                return {
                    data,
                    total: total.count,
                    page: 1,
                    totalPages: 1
                };
            }
            const offset = (page - 1) * count;
            const data = await conn('devices')
                .orderBy('createdAt', 'desc')
                .limit(count)
                .offset(offset);
            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / count)
            };
        }
        catch (error) {
            console.error('Device paginated find error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ id })
                .delete();
        }
        catch (error) {
            console.error('Device delete error:', error);
            throw error;
        }
    }
    async searchByName(searchTerm) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where('deviceName', 'like', `%${searchTerm}%`)
                .orderBy('deviceName', 'asc');
        }
        catch (error) {
            console.error('Device search by name error:', error);
            throw error;
        }
    }
}
exports.DeviceRepository = DeviceRepository;
exports.default = DeviceRepository;
