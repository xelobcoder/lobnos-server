import { Knex } from 'knex';
import {
     Supplier,
     CreateSupplierRequest,
     UpdateSupplierRequest,
     SupplierListResponse
} from './types';
import KnexConnection from '../../database/KnexConnections';

export class SupplierModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private generateSupplierId(): string {
          const timestamp = Date.now().toString();
          return `SUP-${timestamp}`;
     }

     async create(request: CreateSupplierRequest): Promise<Supplier> {
          const connection = await this.connection;

          const supplierData = {
               id: this.generateSupplierId(),
               name: request.name,
               contact: request.contact || null,
               email: request.email || null,
               phone: request.phone || null,
               address: request.address || null,
               is_active: request.is_active !== undefined ? request.is_active : true,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
          };

          await connection('inv_suppliers').insert(supplierData);

          return supplierData;
     }

     async findById(id: string): Promise<Supplier | null> {
          const connection = await this.connection;
          const result = await connection('inv_suppliers')
               .where('id', id)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               contact: result.contact,
               email: result.email,
               phone: result.phone,
               address: result.address,
               is_active: result.is_active,
               created_at: result.created_at,
               updated_at: result.updated_at
          };
     }

     async findMany(page: number = 1, count: number = 10, search?: string): Promise<SupplierListResponse> {
          const connection = await this.connection;

          let query = connection('inv_suppliers')
               .orderBy('name', 'ASC');

          if (search) {
               query = query.where((qb) => {
                    qb.where('name', 'like', `%${search}%`)
                         .orWhere('contact', 'like', `%${search}%`)
                         .orWhere('email', 'like', `%${search}%`);
               });
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt((totalResult as any)?.count || 0);

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const suppliers = rawData.map((result: any) => ({
               id: result.id,
               name: result.name,
               contact: result.contact,
               email: result.email,
               phone: result.phone,
               address: result.address,
               is_active: result.is_active,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));

          return {
               suppliers,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count)
          };
     }

     async update(id: string, updates: UpdateSupplierRequest): Promise<Supplier | null> {
          const connection = await this.connection;

          const currentSupplier = await this.findById(id);
          if (!currentSupplier) {
               throw new Error('Supplier not found');
          }

          const updateData: any = {
               updated_at: new Date().toISOString()
          };

          if (updates.name !== undefined) updateData.name = updates.name;
          if (updates.contact !== undefined) updateData.contact = updates.contact;
          if (updates.email !== undefined) updateData.email = updates.email;
          if (updates.phone !== undefined) updateData.phone = updates.phone;
          if (updates.address !== undefined) updateData.address = updates.address;
          if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

          await connection('inv_suppliers')
               .where({ id })
               .update(updateData);

          return await this.findById(id);
     }

     async delete(id: string): Promise<boolean> {
          const connection = await this.connection;

          const result = await connection('inv_suppliers')
               .where({ id })
               .del();

          return result > 0;
     }

     async getAll(): Promise<Supplier[]> {
          const connection = await this.connection;
          const results = await connection('inv_suppliers')
               .where('is_active', true)
               .orderBy('name', 'ASC');

          return results.map((result: any) => ({
               id: result.id,
               name: result.name,
               contact: result.contact,
               email: result.email,
               phone: result.phone,
               address: result.address,
               is_active: result.is_active,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));
     }
}