"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadActivitiesRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class LeadActivitiesRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(activity) {
        try {
            return await this.connection('lead_activities').insert(activity).returning('*');
        }
        catch (error) {
            console.error('Activity creation error: %d', error);
            throw error;
        }
    }
    async findByLeadId(leadId) {
        try {
            return await this.connection('lead_activities')
                .where({ lead_id: leadId })
                .orderBy('activity_date', 'desc');
        }
        catch (error) {
            console.error('Activity find error:', error);
            throw error;
        }
    }
}
exports.LeadActivitiesRepo = LeadActivitiesRepo;
