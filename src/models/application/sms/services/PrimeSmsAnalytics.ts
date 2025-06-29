import KnexConnection from '../../../../database/KnexConnections';

export class PrimeSmsAnalytics {
    private tenantId: number;
    private db: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.db = KnexConnection(tenantId);
    }

    async getJobStatusCounts() {
        const rows = await this.db('primesmsjobs')
            .select('status')
            .count('* as count')
            .groupBy('status');
        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.status] = Number(row.count);
        }
        return result;
    }

    async getRecipientDeliveryCounts() {
        const rows = await this.db('primesmsjobrecipients')
            .select('deliverystatus')
            .count('* as count')
            .groupBy('deliverystatus');
        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.deliverystatus] = Number(row.count);
        }
        return result;
    }

    async getTotals() {
        const [jobs] = await this.db('primesmsjobs').count('* as count');
        const [recipients] = await this.db('primesmsjobrecipients').count('* as count');
        return {
            totalJobs: Number(jobs.count),
            totalRecipients: Number(recipients.count),
        };
    }

    async getJobCountsByCategory() {
        const rows = await this.db('primesmsjobs')
            .select('category')
            .count('* as count')
            .groupBy('category');
        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.category || 'uncategorized'] = Number(row.count);
        }
        return result;
    }

    async getJobTrendsByDay(days: number = 30) {
        const rows = await this.db('primesmsjobs')
            .select(this.db.raw('DATE(createdat) as day, status'))
            .count('* as count')
            .where('createdat', '>=', this.db.raw(`CURDATE() - INTERVAL ? DAY`, [days]))
            .groupByRaw('DATE(createdat), status')
            .orderBy('day', 'asc');
        const result: Record<string, Record<string, number>> = {};
        for (const row of rows) {
            if (!result[row.day]) result[row.day] = {};
            result[row.day][row.status] = Number(row.count);
        }
        return result;
    }

    async getDeliveryTrendsByDay(days: number = 30) {
        const rows = await this.db('primesmsjobrecipients')
            .select(this.db.raw('DATE(createdat) as day, deliverystatus'))
            .count('* as count')
            .where('createdat', '>=', this.db.raw(`CURDATE() - INTERVAL ? DAY`, [days]))
            .groupByRaw('DATE(createdat), deliverystatus')
            .orderBy('day', 'asc');
        const result: Record<string, Record<string, number>> = {};
        for (const row of rows) {
            if (!result[row.day]) result[row.day] = {};
            result[row.day][row.deliverystatus] = Number(row.count);
        }
        return result;
    }
}
