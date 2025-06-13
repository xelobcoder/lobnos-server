"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadFollowUpsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class LeadFollowUpsRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(followUp) {
        try {
            return await this.connection('lead_followups').insert(Object.assign(Object.assign({}, followUp), { created_at: this.connection.raw('now()') })).returning('*');
        }
        catch (error) {
            console.error('Follow-up creation error:', error);
            throw error;
        }
    }
    async findPendingReminders() {
        try {
            return await this.connection('lead_followups')
                .where({ status: 'pending' })
                .where('scheduled_date', '<=', this.connection.raw('now()'));
        }
        catch (error) {
            console.error('Pending reminders error:', error);
            throw error;
        }
    }
}
exports.LeadFollowUpsRepo = LeadFollowUpsRepo;
