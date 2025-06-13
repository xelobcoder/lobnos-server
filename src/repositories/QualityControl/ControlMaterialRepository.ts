import KnexConnection from "../../database/KnexConnections";


interface ControlMaterial {
    id?: string;
    name: string;
    lotNumber: string;
    sourceType: 'manufacturer' | 'sister_lab' | 'trusted_source';
    manufacturer?: string;
    sourceName?: string;
    expiryDate: Date;
    openedDate?: Date;
    storageConditions: string;
    status: 'active' | 'expired' | 'depleted';
    notes?: string;
    testId: number;
    deviceId?: string;
    createdby: number;
    updatedby: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ControlMaterialWithExpiry extends ControlMaterial {
    isExpired: boolean;
    daysUntilExpiry: number;
}

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

export class ControlMaterialRepository {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(materialData: ControlMaterial): Promise<number> {
        try {
            const conn = await this.connection;
            const [id] = await conn('control_materials')
                .insert(materialData)
            return id;
        } catch (error) {
            console.error('Control material creation error:', error);
            throw error;
        }
    }

    async update(id: string, updates: ControlMaterial): Promise<boolean> {
        try {
            const conn = await this.connection;
            const result = await conn('control_materials')
                .where({ id })
                .update(updates);
            return result > 0;
        } catch (error) {
            console.error('Control material update error:', error);
            throw error;
        }
    }

    async findById(id: string) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ id })
                .first();
        } catch (error) {
            console.error('Control material find error:', error);
            throw error;
        }
    }

    async findByStatus(status: string) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ status })
                .orderBy('expiryDate', 'asc');
        } catch (error) {
            console.error('Control material find by status error:', error);
            throw error;
        }
    }

    async findByExpiryDate(date: string) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where('expiryDate', '<=', date)
                .where('status', 'active')
                .orderBy('expiryDate', 'asc');
        } catch (error) {
            console.error('Control material find by expiry date error:', error);
            throw error;
        }
    }

    async findByDeviceId(deviceId: string) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ deviceId })
                .orderBy('createdAt', 'desc');
        } catch (error) {
            console.error('Control material find by device error:', error);
            throw error;
        }
    }

    async findByTestId(testId: number): Promise<ControlMaterialWithExpiry[]> {
        try {
            const conn = await this.connection;
            const currentDate = new Date();

            const materials = await conn('control_materials')
                .where({ testId })
                .orderBy('createdAt', 'desc');

            return materials.map((material: ControlMaterial) => {
                const expiryDate = new Date(material.expiryDate);
                const daysUntilExpiry = Math.ceil((expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    ...material,
                    isExpired: daysUntilExpiry <= 0,
                    daysUntilExpiry
                };
            });
        } catch (error) {
            console.error('Control material find by test error:', error);
            throw error;
        }
    }

    async findActiveByTestId(testId: number) {
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
        } catch (error) {
            console.error('Control material find active by test error:', error);
            throw error;
        }
    }

    async findAllPaginated(
        page: number = 1,
        limit: number = 10
    ): Promise<PaginatedResponse<any>> {
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
                .select(
                    'control_materials.*',
                    'devices.deviceName',
                    'devices.model',
                    'devices.manufacturer as deviceManufacturer',
                    'devices.serialNumber',
                    'devices.location',
                    'test_panels.name as testPanelName',
                    'roles.username as createdByUser'
                )
                .orderBy('control_materials.createdAt', 'desc')
                .limit(limit)
                .offset(offset);

            const data = rawData.map(material => {
                const expiryDate = new Date(material.expiryDate);
                const daysUntilExpiry = Math.ceil((expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    ...material,
                    currentStatus: daysUntilExpiry <= 0 ? 'expired' : material.status,
                    daysUntilExpiry
                };
            });

            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / limit)
            };
        } catch (error) {
            console.error('Control material paginated find error:', error);
            throw error;
        }
    }

    async delete(id: string) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where({ id })
                .delete();
        } catch (error) {
            console.error('Control material delete error:', error);
            throw error;
        }
    }

    async searchByName(searchTerm: string) {
        try {
            const conn = await this.connection;
            return await conn('control_materials')
                .where('name', 'like', `%${searchTerm}%`)
                .orderBy('name', 'asc');
        } catch (error) {
            console.error('Control material search by name error:', error);
            throw error;
        }
    }
}

export default ControlMaterialRepository