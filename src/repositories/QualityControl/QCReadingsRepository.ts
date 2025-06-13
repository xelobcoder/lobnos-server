import KnexConnection from "../../database/KnexConnections";

interface QCReading {
    id?: string;
    sessionId: string;
    parameter: string;
    value: string;
    status: 'normal' | 'warning' | 'critical' | 'unmonitored';
    createdAt?: Date;
    createdby: number;
    parameterId:number;
}

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

export class QCReadingsRepository {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(readingData: QCReading, trx?: any): Promise<boolean> {
        try {
            const conn = trx || await this.connection;
            const session = await conn('qc_sessions')
                .where({ id: readingData.sessionId })
                .first();
                
            if (!session) {
                throw new Error('Invalid session ID: Session must be created before adding readings');
            }

            const [id] = await conn('qc_readings')
                .insert({
                    ...readingData,
                    createdAt: conn.fn.now()
                });
            return id > 0;
        } catch (error) {
            console.error('QC reading creation error:', error);
            throw error;
        }
    }

    async update(id: string, updates: Partial<QCReading>): Promise<boolean> {
        try {
            const conn = await this.connection;
            const result = await conn('qc_readings')
                .where({ id })
                .update(updates);
            return result > 0;
        } catch (error) {
            console.error('QC reading update error:', error);
            throw error;
        }
    }

    async findById(id: string): Promise<QCReading | null> {
        try {
            const conn = await this.connection;
            return await conn('qc_readings')
                .where({ id })
                .first();
        } catch (error) {
            console.error('QC reading find error:', error);
            throw error;
        }
    }

    async findBySessionId(sessionId: string): Promise<QCReading[]> {
        try {
            const conn = await this.connection;
            return await conn('qc_readings as qr')
                .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
                .where({ 'qr.sessionId': sessionId })
                .select('qr.*', 'cp.*')
                .orderBy('qr.createdAt', 'desc');
        } catch (error) {
            console.error('QC reading find by session error:', error);
            throw error;
        }
    }

    async findBySessionAndControlId(sessionId: string, controlId: string): Promise<QCReading[]> {
        try {
            const conn = await this.connection;
            return await conn('qc_readings as qr')
                .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
                .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
                .where({
                    'qr.sessionId': sessionId,
                    'qs.controlMaterialId': controlId
                })
                .select('qr.*', 'cp.*')
                .orderBy('qr.createdAt', 'desc');
        } catch (error) {
            console.error('QC reading find by session and control ID error:', error);
            throw error;
        }
    }

    async findByParameter(parameter: string): Promise<QCReading[]> {
        try {
            const conn = await this.connection;
            return await conn('qc_readings')
                .where({ parameter })
                .orderBy('createdAt', 'desc');
        } catch (error) {
            console.error('QC reading find by parameter error:', error);
            throw error;
        }
    }

    async findByStatus(status: 'normal' | 'warning' | 'critical' | 'unmonitored'): Promise<QCReading[]> {
        try {
            const conn = await this.connection;
            return await conn('qc_readings')
                .where({ status })
                .orderBy('createdAt', 'desc');
        } catch (error) {
            console.error('QC reading find by status error:', error);
            throw error;
        }
    }

    async findAllPaginated(
        page: number = 1,
        limit: number = 10
    ): Promise<PaginatedResponse<QCReading & {
        control_material_name: string;
        created_by_username: string;
        parameter_name: string; 
    }>> {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;

            const [total] = await conn('qc_readings')
                .count('id as count');

            const data = await conn('qc_readings as qr')
                .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
                .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
                .leftJoin('roles as r', 'qs.createdby', 'r.employeeid')
                .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id') 
                .select(
                    'qr.*',
                    'cm.name as control_material_name',
                    'r.username as created_by_username',
                    'cp.*'
                )
                .orderBy('qr.createdAt', 'desc')
                .limit(limit)
                .offset(offset);

            return {
                data,
                total: Number(total.count),
                page,
                totalPages: Math.ceil(Number(total.count) / limit)
            };
        } catch (error) {
            console.error('QC reading paginated find error:', error);
            throw error;
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const conn = await this.connection;
            const result = await conn('qc_readings')
                .where({ id })
                .delete();
            return result > 0;
        } catch (error) {
            console.error('QC reading delete error:', error);
            throw error;
        }
    }

    async findBatchesBySessionId(sessionId: string): Promise<Array<{
        date: string;
        count: number;
        createdBy: string;
        sessionId: string;
    }>> {
        try {
            const conn = await this.connection;
            return await conn('qc_readings as qr')
                .leftJoin('roles as r', 'qr.createdby', 'r.employeeid')
                .where({ 'qr.sessionId': sessionId })
                .select(
                    conn.raw('DATE(qr.createdAt) as date'),
                    conn.raw('COUNT(DISTINCT qr.parameterId) as count'),
                    'qr.sessionId',
                    'r.username as createdBy'
                )
                .groupBy(
                    conn.raw('DATE(qr.createdAt)'),
                    'qr.sessionId',
                    'r.username'
                )
                .orderBy('date', 'desc');
        } catch (error) {
            console.error('QC reading batch summary error:', error);
            throw error;
        }
    }
}

export default QCReadingsRepository;