import KnexConnection from "../../database/KnexConnections";

interface QCSession {
    id?: string;
    controlMaterialId?: string;
    comments?: string;
    createdby: number;
    updatedby?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

export class QCSessionsRepository {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(sessionData: QCSession, trx?: any): Promise<boolean> {
        try {
            const conn = trx || await this.connection;
            const [id] = await conn('qc_sessions')
                .insert(sessionData);
            return id == 0;
        } catch (error) {
            console.error('QC session creation error:', error);
            throw error;
        }
    }

    async findById(id: string): Promise<QCSession | null> {
        try {
            const conn = await this.connection;
            return await conn('qc_sessions')
                .where({ id })
                .first();
        } catch (error) {
            console.error('QC session find error:', error);
            throw error;
        }
    }

    async findByControlMaterial(controlMaterialId: string): Promise<QCSession[]> {
        try {
            const conn = await this.connection;
            return await conn('qc_sessions')
                .where({ controlMaterialId })
                .orderBy('createdAt', 'desc');
        } catch (error) {
            console.error('QC session find by control material error:', error);
            throw error;
        }
    }

    async findAllPaginated(
        page: number = 1,
        limit: number = 10
    ): Promise<PaginatedResponse<QCSession & {
        control_material_name: string;
        created_by_username: string;
    }>> {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;

            const [total] = await conn('qc_sessions')
                .count('id as count');

            const data = await conn('qc_sessions as qs')
                .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
                .leftJoin('roles as r', 'qs.createdby', 'r.employeeid')
                .select(
                    'qs.*',
                    'cm.name as control_material_name',
                    'r.username as created_by_username'
                )
                .orderBy('qs.createdAt', 'desc')
                .limit(limit)
                .offset(offset);

            return {
                data,
                total: Number(total.count),
                page,
                totalPages: Math.ceil(Number(total.count) / limit)
            };
        } catch (error) {
            console.error('QC session paginated find error:', error);
            throw error;
        }
    }

    async update(id: string, updates: Partial<QCSession>): Promise<boolean> {
        try {
            const conn = await this.connection;
            const result = await conn('qc_sessions')
                .where({ id })
                .update(updates);
            return result > 0;
        } catch (error) {
            console.error('QC session update error:', error);
            throw error;
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const conn = await this.connection;
            const result = await conn('qc_sessions')
                .where({ id })
                .delete();
            return result > 0;
        } catch (error) {
            console.error('QC session delete error:', error);
            throw error;
        }
    }
}

export default QCSessionsRepository;