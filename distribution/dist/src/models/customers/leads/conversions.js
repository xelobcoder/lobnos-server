"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadConversionRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class LeadConversionRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createOrUpdate(conversion) {
        try {
            return await this.connection('lead_conversions')
                .insert(conversion)
                .onConflict('lead_id')
                .merge()
                .returning('*');
        }
        catch (error) {
            console.error('Conversion error:', error);
            throw error;
        }
    }
    async findByLeadId(leadId) {
        try {
            return await this.connection('lead_conversions')
                .where({ lead_id: leadId })
                .first();
        }
        catch (error) {
            console.error('Conversion find error:', error);
            throw error;
        }
    }
}
exports.LeadConversionRepo = LeadConversionRepo;
