import KnexConnection from "../../../database/KnexConnections";

interface SmsLog {
    id?: number;
    sms_content: string;
    receiver_id: number;
    receiver_type: 'outsourcing' | 'clients' | 'staffs' | 'organizations' | 'clinicians';
    time_sent?: Date;
    time_delivered?: Date;
    is_event?: boolean;
    event_name?: string;
    year?: number;
    messagestatus?: 'pending' | 'sent' | 'failed' | 'delivered';
    sender_id?: number;
    sender_type?: 'system' | 'staff' | 'admin';
    retries?: number;
    error_message?: string;
}

export default class SmsLogsRepository {
    private connection;
    private tablename: string = 'sms_logs';

    constructor(tenantId: number) {
        this.connection = KnexConnection(tenantId);
    }

    async createLog(logData: SmsLog): Promise<number> {
        const connection = await this.connection;
        const [id] = await connection(this.tablename).insert(logData).returning('id');
        return id;
    }

    async getLogById(id: number): Promise<SmsLog | null> {
        const connection = await this.connection;
        const result = await connection(this.tablename)
            .where({ id })
            .first();
        return result || null;
    }

    async updateLog(id: number, logData: Partial<SmsLog>): Promise<number> {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ id })
            .update(logData);
    }

    async markAsDelivered(id: number): Promise<number> {
        return this.updateLog(id, {
            messagestatus: 'delivered',
            time_delivered: new Date()
        });
    }

    async markAsFailed(id: number, error: string): Promise<number> {
        const connection = await this.connection;
        return this.updateLog(id, {
            messagestatus: 'failed',
            error_message: error,
            retries: connection.raw('retries + 1')
        });
    }

    async getMessagesByStatus(status: SmsLog['messagestatus']): Promise<SmsLog[]> {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ messagestatus: status })
            .orderBy('time_sent', 'desc');
    }

    async getPendingRetries(maxRetries: number = 3): Promise<SmsLog[]> {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ messagestatus: 'failed' })
            .where('retries', '<', maxRetries)
            .orderBy('time_sent', 'asc');
    }

    async getRecipientMessages(
        receiverId: number,
        receiverType: SmsLog['receiver_type']
    ): Promise<SmsLog[]> {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({
                receiver_id: receiverId,
                receiver_type: receiverType
            })
            .orderBy('time_sent', 'desc');
    }

    async getEventMessages(eventName: string): Promise<SmsLog[]> {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({
                is_event: true,
                event_name: eventName
            })
            .orderBy('time_sent', 'desc');
    }

    async getMessageStats(startDate: Date, endDate: Date) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .select('messagestatus')
            .count('* as count')
            .whereBetween('time_sent', [startDate, endDate])
            .groupBy('messagestatus');
    }

    async deleteLog(id: number): Promise<number> {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ id })
            .del();
    }

    async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
        const connection = await this.connection;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        return await connection(this.tablename)
            .where('time_sent', '<', cutoffDate)
            .del();
    }
}