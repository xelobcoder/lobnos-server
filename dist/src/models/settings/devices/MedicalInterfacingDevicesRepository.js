"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class MedicalInterfacingDevicesRepository {
    constructor(tenantId) {
        this.tablename = 'medicalinterfacingdevices';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createDevice(device) {
        try {
            const connection = await this.connection;
            const result = await connection(this.tablename).insert(device).returning('id');
            return result[0];
        }
        catch (error) {
            throw new Error('Failed to create device: ' + error.message);
        }
    }
    async getDeviceById(id) {
        const connection = await this.connection;
        const record = await connection(this.tablename).where({ id }).first();
        if (record) {
            if (typeof record.testid === 'string') {
                if (record.testid.trim() === '') {
                    record.testid = [];
                }
                else if (record.testid.includes(',')) {
                    record.testid = record.testid.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                }
                else {
                    const n = parseInt(record.testid.trim(), 10);
                    record.testid = isNaN(n) ? [] : [n];
                }
            }
            else if (record.testid == null) {
                record.testid = [];
            }
        }
        return record;
    }
    async updateDevice(id, device) {
        try {
            const connection = await this.connection;
            if (device.testid && Array.isArray(device.testid)) {
                device.testid = device.testid.join(',');
            }
            return connection(this.tablename).where({ id }).update(device);
        }
        catch (error) {
            console.log('Error updating device:', error);
            throw new Error('Failed to update device: ' + error.message);
        }
    }
    async deleteDevice(id) {
        const connection = await this.connection;
        return connection(this.tablename).where({ id }).del();
    }
    async getAllDevices() {
        const connection = await this.connection;
        const records = await connection(this.tablename).select('*');
        const recreatedRecords = records.map((rec) => {
            if (rec) {
                if (typeof rec.testid === 'string') {
                    if (rec.testid.trim() === '') {
                        rec.testid = [];
                    }
                    else if (rec.testid.includes(',')) {
                        rec.testid = rec.testid.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                    }
                    else {
                        const n = parseInt(rec.testid.trim(), 10);
                        rec.testid = isNaN(n) ? [] : [n];
                    }
                }
                else if (rec.testid == null) {
                    rec.testid = [];
                }
            }
            return rec;
        });
        for (const rec of recreatedRecords) {
            if (rec && rec.testid && Array.isArray(rec.testid)) {
                const Connetion = await this.connection;
                const testNames = await Connetion('test_panels').whereIn('id', rec.testid).select('name');
                rec['test_names'] = testNames.map(t => t.name).join(', ');
            }
        }
        return recreatedRecords;
    }
    async getActiveDevices() {
        const connection = await this.connection;
        const records = await connection(this.tablename).where({ active: 1 }).select('*');
        return records.map((rec) => {
            if (rec) {
                if (typeof rec.testid === 'string') {
                    if (rec.testid.trim() === '') {
                        rec.testid = [];
                    }
                    else if (rec.testid.includes(',')) {
                        rec.testid = rec.testid.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                    }
                    else {
                        const n = parseInt(rec.testid.trim(), 10);
                        rec.testid = isNaN(n) ? [] : [n];
                    }
                }
                else if (rec.testid == null) {
                    rec.testid = [];
                }
            }
            return rec;
        });
    }
    async findByIP(ip) {
        const connection = await this.connection;
        const record = await connection(this.tablename).where({ ip }).first();
        if (record) {
            if (typeof record.testid === 'string') {
                if (record.testid.trim() === '') {
                    record.testid = [];
                }
                else if (record.testid.includes(',')) {
                    record.testid = record.testid.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                }
                else {
                    const n = parseInt(record.testid.trim(), 10);
                    record.testid = isNaN(n) ? [] : [n];
                }
            }
            else if (record.testid == null) {
                record.testid = [];
            }
        }
        return record;
    }
}
exports.default = MedicalInterfacingDevicesRepository;
