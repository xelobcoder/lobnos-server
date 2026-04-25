import { Knex } from 'knex';
import {
     StorageLocation,
     CreateStorageLocationRequest,
     UpdateStorageLocationRequest,
     StorageLocationListResponse
} from './types';
import KnexConnection from '../../database/KnexConnections';


export class StorageLocationModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private generateLocationId(): string {
          const timestamp = Date.now().toString();
          return `LOC-${timestamp}`;
     }

     async create(request: CreateStorageLocationRequest): Promise<StorageLocation> {
          const connection = await this.connection;

          // Check if location name already exists
          const existing = await connection('inv_storage_locations')
               .where('name', request.name)
               .first();

          if (existing) {
               throw new Error('Storage location name already exists');
          }

          const locationData = {
               id: this.generateLocationId(),
               name: request.name,
               description: request.description || null,
               capacity: request.capacity || null,
               temperature_controlled: request.temperature_controlled || false,
               temperature_range: request.temperature_range || null,
               hazardous_materials: request.hazardous_materials || false,
               is_active: request.is_active !== undefined ? request.is_active : true,
               created_at: new Date() as any  ,
               updated_at: new Date()  as any
          };

          await connection('inv_storage_locations').insert(locationData);

          return locationData;
     }

     async findById(id: string): Promise<StorageLocation | null> {
          const connection = await this.connection;
          const result = await connection('inv_storage_locations')
               .where('id', id)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               description: result.description,
               capacity: result.capacity,
               temperature_controlled: result.temperature_controlled,
               temperature_range: result.temperature_range,
               hazardous_materials: result.hazardous_materials,
               is_active: result.is_active,
               created_at: result.created_at,
               updated_at: result.updated_at
          };
     }

     async findMany(page: number = 1, count: number = 10, search?: string, sortby: 'ASC' | 'DESC' = 'ASC'): Promise<StorageLocationListResponse> {
          const connection = await this.connection;

          let query = connection('inv_storage_locations')
               .orderBy('name', sortby.toLowerCase() as 'asc' | 'desc');

          if (search) {
               query = query.where('name', 'like', `%${search}%`)
                    .orWhere('description', 'like', `%${search}%`);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt((totalResult as any)?.count || 0);

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const locations = rawData.map((result: any) => ({
               id: result.id,
               name: result.name,
               description: result.description,
               capacity: result.capacity,
               temperature_controlled: result.temperature_controlled,
               temperature_range: result.temperature_range,
               hazardous_materials: result.hazardous_materials,
               is_active: result.is_active,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));

          return {
               locations,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count),
               sortby
          };
     }

     async update(id: string, updates: UpdateStorageLocationRequest): Promise<StorageLocation | null> {
          const connection = await this.connection;

          const currentLocation = await this.findById(id);
          if (!currentLocation) {
               throw new Error('Storage location not found');
          }

          if (updates.name && updates.name !== currentLocation.name) {
               // Check if new name already exists
               const existing = await connection('inv_storage_locations')
                    .where('name', updates.name)
                    .whereNot('id', id)
                    .first();

               if (existing) {
                    throw new Error('Storage location name already exists');
               }
          }

          const updateData: any = {
               updated_at: new Date()
          };

          if (updates.name !== undefined) updateData.name = updates.name;
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
          if (updates.temperature_controlled !== undefined) updateData.temperature_controlled = updates.temperature_controlled;
          if (updates.temperature_range !== undefined) updateData.temperature_range = updates.temperature_range;
          if (updates.hazardous_materials !== undefined) updateData.hazardous_materials = updates.hazardous_materials;
          if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

          await connection('inv_storage_locations')
               .where({ id })
               .update(updateData);

          return await this.findById(id);
     }

     async delete(id: string): Promise<boolean> {
          const connection = await this.connection;

          const result = await connection('inv_storage_locations')
               .where({ id })
               .del();

          return result > 0;
     }

     async getAll(): Promise<StorageLocation[]> {
          const connection = await this.connection;
          const results = await connection('inv_storage_locations')
               .where('is_active', true)
               .orderBy('name', 'ASC');

          return results.map((result: any) => ({
               id: result.id,
               name: result.name,
               description: result.description,
               capacity: result.capacity,
               temperature_controlled: result.temperature_controlled,
               temperature_range: result.temperature_range,
               hazardous_materials: result.hazardous_materials,
               is_active: result.is_active,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));
     }
}