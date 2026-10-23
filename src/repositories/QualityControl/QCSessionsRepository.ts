

import KnexConnection from "../../database/KnexConnections";
import { v4 as uuidv4 } from 'uuid';


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
    async getRecentReadingsWithDetails(limit: number = 10) {
        const conn = await this.connection;
        const readings = await conn('qc_readings as qr')
            .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
            .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
            .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
            .select(
                'qr.*',
                'qs.comments as session_comments',
                'qs.createdAt as session_createdAt',
                'cm.name as control_material_name',
                'cm.lotNumber as control_material_lotNumber',
                'cm.status as control_material_status',
                'cp.parameter as parameter_name',
                'cp.value as parameter_value',
                'cp.unit as parameter_unit',
                'cp.warningLimit',
                'cp.actionLimit'
            )
            .orderBy('qr.createdAt', 'desc')
            .limit(limit);
        return readings;
    }

    async getRecentAlertReadings(limit: number = 10) {
        const conn = await this.connection;
        const alertStatuses = ['critical', 'warning', 'unmonitored'];
        const readings = await conn('qc_readings as qr')
            .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
            .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
            .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
            .select(
                'qr.*',
                'qs.comments as session_comments',
                'qs.createdAt as session_createdAt',
                'cm.name as control_material_name',
                'cm.lotNumber as control_material_lotNumber',
                'cm.status as control_material_status',
                'cp.parameter as parameter_name',
                'cp.value as parameter_value',
                'cp.unit as parameter_unit',
                'cp.warningLimit',
                'cp.actionLimit'
            )
            .whereIn('qr.status', alertStatuses)
            .orderBy('qr.createdAt', 'desc')
            .limit(limit);
        return readings;
    }
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(sessionData: QCSession, trx?: any): Promise<boolean> {
        try {
            const conn = trx || await this.connection;
            const id = uuidv4();
            const returned_value = await conn('qc_sessions')
                .insert({ ...sessionData, id })
            return returned_value[0]
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

    async recordResultEntryReview(
        sessionId: string,
        employeeId: number,
        decision: 'accepted' | 'bypassed' | 'rejected',
        reason?: string
    ): Promise<number> {
        const connection = await this.connection;
        return connection.transaction(async (trx: any) => {
            const session = await trx('qc_sessions as qs')
                .innerJoin('control_materials as cm', 'cm.id', 'qs.controlMaterialId')
                .select('qs.id', 'cm.testId', 'cm.deviceId')
                .where('qs.id', sessionId)
                .whereRaw('DATE(qs.createdAt) = CURRENT_DATE()')
                .where('cm.status', 'active')
                .whereRaw('DATE(cm.expiryDate) >= CURRENT_DATE()')
                .first();
            if (!session) throw new Error('QC session must be linked to an active, unexpired control material and recorded today.');

            if (['bypassed', 'rejected'].includes(decision) && !reason?.trim()) {
                throw new Error('A reason is required to bypass or revoke QC enforcement.');
            }

            if (decision === 'accepted') {
                const readings = await trx('qc_readings').select('status').where({ sessionId });
                if (readings.length === 0 || readings.some((reading: any) => reading.status !== 'normal')) {
                    throw new Error('QC cannot be accepted until readings are recorded and all are normal.');
                }
            }

            const actor = await trx('roles').where({ employeeid: employeeId }).first('branch');
            if (!Number(actor?.branch)) throw new Error('A branch must be assigned to the QC reviewer');
            await trx('qc_session_review_audit').insert({
                branchid: Number(actor.branch), device_id: session.deviceId || null,
                session_id: sessionId,
                testid: Number(session.testId),
                working_date: trx.raw('CURRENT_DATE()'),
                decision,
                reason: reason?.trim() || null,
                employeeid: employeeId,
            });
            return Number(session.testId);
        });
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


    async getDashboardData(): Promise<{
        totalDevices: number;
        activeDevices: number;
        devicesInMaintenance: number;
        qcTestsToday: number;
        critical: number;
        unmonitored: number;
        warning: number;
        pendingReviews: number;
    }> {
        const conn = await this.connection;


        const [{ count: totalDevices }] = await conn('devices').count('id as count').catch(() => [{ count: 0 }]);
        const [{ count: activeDevices }] = await conn('devices').where({ status: 'active' }).count('id as count').catch(() => [{ count: 0 }]);
        const [{ count: devicesInMaintenance }] = await conn('devices').where({ status: 'maintenance' }).count('id as count').catch(() => [{ count: 0 }]);

        const today = new Date();
        const [{ count: qcTestsToday }] = await conn('qc_sessions')
            .whereRaw("CAST(createdAt AS DATE) = ?", [today])
            .count('id as count');


        const [{ count: critical }] = await conn('qc_readings')
            .where({ status: 'critical' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);

        const [{ count: unmonitored }] = await conn('qc_readings')
            .where({ status: 'unmonitored' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);

        const [{ count: warning }] = await conn('qc_readings')
            .where({ status: 'warning' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);

        const [{ count: pendingReviews }] = await conn('qc_sessions')
            .where({ status: 'pending_review' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);

        return {
            totalDevices: Number(totalDevices) || 0,
            activeDevices: Number(activeDevices) || 0,
            devicesInMaintenance: Number(devicesInMaintenance) || 0,
            qcTestsToday: Number(qcTestsToday) || 0,
            critical: Number(critical) || 0,
            unmonitored: Number(unmonitored) || 0,
            warning: Number(warning) || 0,
            pendingReviews: Number(pendingReviews) || 0,
        };
    }
}

export default QCSessionsRepository;