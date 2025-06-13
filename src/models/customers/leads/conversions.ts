import KnexConnection from "../../../database/KnexConnections";
import { LeadConversion } from "./dev/types";


export class LeadConversionRepo {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async createOrUpdate(conversion: Omit<LeadConversion, 'id'>) {
        try {
            return await this.connection('lead_conversions')
                .insert(conversion)
                .onConflict('lead_id')
                .merge()
                .returning('*');
        } catch (error) {
            console.error('Conversion error:', error);
            throw error;
        }
    }

    async findByLeadId(leadId: string) {
        try {
            return await this.connection('lead_conversions')
                .where({ lead_id: leadId })
                .first();
        } catch (error) {
            console.error('Conversion find error:', error);
            throw error;
        }
    }
}