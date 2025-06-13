import KnexConnection from "../../../database/KnexConnections";
import { Lead, PaginatedResponse } from "./dev/types";




export class CustomersLeads {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId)
    }

    async create(lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) {
        try {
            return await this.connection("customersleads").insert({
                ...lead,
                created_at: this.connection.raw('now()'),
                updated_at: this.connection.raw('now()')
            }).returning('*');
        } catch (error) {
            console.error('Lead creation error:', error);
            throw error;
        }
    }

    async findById(id: string) {
        try {
            return await this.connection("customersleads").where({ id }).first();
        } catch (error) {
            console.error('Lead find error:', error);
            throw error;
        }
    }

    async update(id: string, updates: Partial<Lead>) {
        try {
            return await this.connection("customersleads")
                .where({ id })
                .update({
                    ...updates,
                    updated_at: this.connection.raw('now()')
                });
        } catch (error) {
            console.error('Lead update error:', error);
            throw error;
        }
    }

    async delete(id: string) {
        try {
            return await this.connection("customersleads").where({ id }).delete();
        } catch (error) {
            console.error('Lead delete error:', error);
            throw error;
        }
    }

    async findByStatus(status: Lead['status']) {
        try {
            return await this.connection("customersleads")
                .where({ status })
                .orderBy('created_at', 'desc');
        } catch (error) {
            console.error('Lead find by status error:', error);
            throw error;
        }
    }

    async findAllPaginated(page: number = 1, count: number = 10): Promise<PaginatedResponse<Lead>> {
        try {
            const [total] = await this.connection("customersleads").count('id as count');
            const offset = (page - 1) * count;
            
            const data = await this.connection
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
            return await this.connection("customersleads")
                .where('name', 'like', `%${searchTerm}%`)
                .orderBy('name', 'asc');
        } catch (error) {
            console.error('Lead search by name error:', error);
            throw error;
        }
    }

    async findByAssignedUser(userId: string) {
        try {
            return await this.connection("customersleads")
                .where({ assigned_to: userId })
                .orderBy('priority', 'desc');
        } catch (error) {
            console.error('Lead find by assigned user error:', error);
            throw error;
        }
    }
}





// Migration files would be created separately. Example for leads table:
export const up = knex => knex.schema.createTable('leads', table => {
     table.uuid('id').primary();
     table.string('name').notNullable();
     table.string('contact_person').notNullable();
     table.string('contact_email').notNullable();
     table.string('contact_phone').notNullable();
     table.string('company_name');
     table.string('industry_type').notNullable();
     table.string('lead_source').notNullable();
     table.string('service_interest').notNullable();
     table.enum('status', ['new', 'contacted', 'qualified', 'converted', 'lost']).defaultTo('new');
     table.enum('priority', ['low', 'medium', 'high']).defaultTo('medium');
     table.string('location').notNullable();
     table.uuid('assigned_to').references('id').inTable('users');
     table.text('notes');
     table.timestamp('created_at').defaultTo(knex.fn.now());
     table.timestamp('updated_at').defaultTo(knex.fn.now());
});

export const down = knex => knex.schema.dropTable('leads');