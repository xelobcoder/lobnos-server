import KnexConnection from "../../database/KnexConnections";
import { v4 as uuidv4 } from 'uuid';


interface Device {
    id?: string;
    deviceName: string;
    model: string;
    serialNumber: string;
    manufacturer: string;
    installationDate: Date;
    lastCalibrationDate: Date;
    calibrationFrequency: number;
    location: string;
    status: 'active' | 'maintenance' | 'inactive';
    notes?: string;
    createdby: number;
    updatedby: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

export class DeviceRepository {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(deviceData: Device): Promise<number> {
        try {
            const conn = await this.connection;
            const id = uuidv4();
            const result = await conn('devices')
                .insert({ ...deviceData, id, updatedby: deviceData.createdby });
            return result[0];
        } catch (error) {
            console.error('Device creation error:', error);
            throw error;
        }
    }

    async update(id: string, updates: any) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ id })
                .update(updates);
        } catch (error) {
            console.error('Device update error:', error);
            throw error;
        }
    }

    async findById(id: string) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ id })
                .first();
        } catch (error) {
            console.error('Device find error:', error);
            throw error;
        }
    }

    async findByStatus(status: string) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ status })
                .orderBy('nextCalibrationDate', 'asc');
        } catch (error) {
            console.error('Device find by status error:', error);
            throw error;
        }
    }

    async findByCalibrationDue(date: string) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where('nextCalibrationDate', '<=', date)
                .where('status', 'active')
                .orderBy('nextCalibrationDate', 'asc');
        } catch (error) {
            console.error('Device find by calibration due error:', error);
            throw error;
        }
    }

    async findAllPaginated(
        page?: number,
        count?: number
    ): Promise<PaginatedResponse<Device>> {
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
                totalPages: Math.ceil(total.count/count)
            };
        } catch (error) {
            console.error('Device paginated find error:', error);
            throw error;
        }
    }

    async delete(id: string) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where({ id })
                .delete();
        } catch (error) {
            console.error('Device delete error:', error);
            throw error;
        }
    }

    async searchByName(searchTerm: string) {
        try {
            const conn = await this.connection;
            return await conn('devices')
                .where('deviceName', 'like', `%${searchTerm}%`)
                .orderBy('deviceName', 'asc');
        } catch (error) {
            console.error('Device search by name error:', error);
            throw error;
        }
    }
}

export default DeviceRepository