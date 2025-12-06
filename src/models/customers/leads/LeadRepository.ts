import KnexConnection from "../../../database/KnexConnections";
import { Lead, PaginatedResponse, CreateLeadSchema, UpdateLeadSchema } from "./dev/types";




export class CustomersLeads {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId)
    }

    async create(lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) {
        try {
            const connection = await this.connection;
            const validatedLead = CreateLeadSchema.parse(lead);
            return await connection("leads").insert({
                ...validatedLead,
                created_at: connection.raw('now()'),
                updated_at: connection.raw('now()')
            }).returning('*');
        } catch (error: any) {
            console.error('Lead creation error:', error);
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new Error('A lead with this email address already exists');
            }
            throw error;
        }
    }

    async findById(id: number) {
        try {
            const connection = await this.connection;
            return await connection("leads").where({ id }).first();
        } catch (error) {
            console.error('Lead find error:', error);
            throw error;
        }
    }

    async update(id: number, updates: Partial<Lead>) {
        try {
            const connection = await this.connection;
            const validatedUpdates = UpdateLeadSchema.parse(updates);
            return await connection("leads")
                .where({ id })
                .update({
                    ...validatedUpdates,
                    updated_at: connection.raw('now()')
                });
        } catch (error) {
            console.error('Lead update error:', error);
            throw error;
        }
    }

    async delete(id: number) {
        try {
            const connection = await this.connection;
            return await connection("leads").where({ id }).delete();
        } catch (error) {
            console.error('Lead delete error:', error);
            throw error;
        }
    }

    async findByStatus(status: Lead['status']) {
        try {
            const connection = await this.connection;
            return await connection("leads")
                .where({ status })
                .orderBy('created_at', 'desc');
        } catch (error) {
            console.error('Lead find by status error:', error);
            throw error;
        }
    }

    async findAllPaginated(page: number = 1, count: number = 10): Promise<PaginatedResponse<Lead>> {
        try {
            const connection = await this.connection;
            const [total] = await connection("leads").count('id as count');
            const offset = (page - 1) * count;

            const data = await connection("leads")
                .orderBy('created_at', 'desc')
                .limit(count)
                .offset(offset);

            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / count)
            };
        } catch (error) {
            console.error('Lead paginated find error:', error);
            throw error;
        }
    }

    async searchByName(searchTerm: string) {
        try {
            const connection = await this.connection;
            return await connection("leads")
                .where('firstname', 'like', `%${searchTerm}%`)
                .orWhere('lastname', 'like', `%${searchTerm}%`)
                .orderBy('firstname', 'asc');
        } catch (error) {
            console.error('Lead search by name error:', error);
            throw error;
        }
    }

    async findByAssignedUser(userId: number) {
        try {
            const connection = await this.connection;
            return await connection("leads")
                .where({ assigned_to: userId })
                .orderBy('priority', 'desc');
        } catch (error) {
            console.error('Lead find by assigned user error:', error);
            throw error;
        }
    }
}
