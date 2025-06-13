import KnexConnection from "../../../database/KnexConnections";
import { LeadFollowUp } from "./dev/types";


export class LeadFollowUpsRepo {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(followUp: Omit<LeadFollowUp, 'id'>) {
        try {
            return await this.connection('lead_followups').insert({
                ...followUp,
                created_at: this.connection.raw('now()')
            }).returning('*');
        } catch (error) {
            console.error('Follow-up creation error:', error);
            throw error;
        }
    }

    async findPendingReminders() {
        try {
            return await this.connection('lead_followups')
                .where({ status: 'pending' })
                .where('scheduled_date', '<=', this.connection.raw('now()'));
        } catch (error) {
            console.error('Pending reminders error:', error);
            throw error;
        }
    }
}