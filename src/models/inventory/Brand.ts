import { Knex } from 'knex';
import {
     Brand,
     CreateBrandRequest,
     UpdateBrandRequest,
     BrandListResponse
} from './types';
import KnexConnection from '../../database/KnexConnections';

export class BrandModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private generateBrandId(): string {
          const timestamp = Date.now().toString();
          return `BRD-${timestamp}`;
     }

     async create(request: CreateBrandRequest): Promise<Brand> {
          const connection = await this.connection;

          // Check if brand name already exists
          const existing = await connection('inv_brands')
               .where('name', request.name)
               .first();

          if (existing) {
               throw new Error('Brand name already exists');
          }

          const brandData = {
               id: this.generateBrandId(),
               name: request.name,
               created_date: new Date().toISOString(),
               item_count: 0,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
          };

          await connection('inv_brands').insert(brandData);

          return {
               id: brandData.id,
               name: brandData.name,
               created_date: brandData.created_date,
               item_count: brandData.item_count,
               created_at: brandData.created_at,
               updated_at: brandData.updated_at
          };
     }

     async findById(id: string): Promise<Brand | null> {
          const connection = await this.connection;
          const result = await connection('inv_brands')
               .where('id', id)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               created_date: result.created_date,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          };
     }

     async findByName(name: string): Promise<Brand | null> {
          const connection = await this.connection;
          const result = await connection('inv_brands')
               .where('name', name)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               created_date: result.created_date,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          };
     }

     async findMany(page: number = 1, count: number = 10, search?: string): Promise<BrandListResponse> {
          const connection = await this.connection;

          let query = connection('inv_brands')
               .orderBy('name', 'ASC');

          if (search) {
               query = query.where('name', 'like', `%${search}%`);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const brands = rawData.map((result: any) => ({
               id: result.id,
               name: result.name,
               created_date: result.created_date,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));

          return {
               brands,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count)
          };
     }

     async update(id: string, updates: UpdateBrandRequest): Promise<Brand | null> {
          const connection = await this.connection;

          const currentBrand = await this.findById(id);
          if (!currentBrand) {
               throw new Error('Brand not found');
          }

          if (updates.name && updates.name !== currentBrand.name) {
               // Check if new name already exists
               const existing = await connection('inv_brands')
                    .where('name', updates.name)
                    .whereNot('id', id)
                    .first();

               if (existing) {
                    throw new Error('Brand name already exists');
               }
          }

          const updateData: any = {
               updated_at: new Date().toISOString()
          };

          if (updates.name !== undefined) updateData.name = updates.name;

          await connection('inv_brands')
               .where({ id })
               .update(updateData);

          return await this.findById(id);
     }

     async delete(id: string): Promise<boolean> {
          const connection = await this.connection;

          // Check if brand is in use
          const brand = await this.findById(id);
          if (!brand) {
               return false;
          }

          if (brand.item_count > 0) {
               throw new Error('Cannot delete brand in use');
          }

          const result = await connection('inv_brands')
               .where({ id })
               .del();

          return result > 0;
     }

     async bulkCreate(brands: CreateBrandRequest[]): Promise<{ success: boolean; brands: Brand[]; errors: Array<{ name: string; error: string }> }> {
          const connection = await this.connection;
          const createdBrands: Brand[] = [];
          const errors: Array<{ name: string; error: string }> = [];

          for (const brandRequest of brands) {
               try {
                    const brand = await this.create(brandRequest);
                    createdBrands.push(brand);
               } catch (error: any) {
                    errors.push({
                         name: brandRequest.name,
                         error: error.message || 'Unknown error'
                    });
               }
          }

          return {
               success: errors.length === 0,
               brands: createdBrands,
               errors
          };
     }

     async getAll(): Promise<Brand[]> {
          const connection = await this.connection;
          const results = await connection('inv_brands')
               .orderBy('name', 'ASC');

          return results.map((result: any) => ({
               id: result.id,
               name: result.name,
               created_date: result.created_date,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));
     }

     async getStats(): Promise<{ total_brands: number; total_items: number; average_items_per_brand: number }> {
          const connection = await this.connection;

          const totalBrands = await connection('inv_brands').count('* as count').first();
          const totalItems = await connection('inv_brands').sum('item_count as total').first();

          const totalBrandsCount = parseInt(totalBrands?.count as string) || 0;
          const totalItemsCount = parseInt(totalItems?.total as string) || 0;
          const averageItemsPerBrand = totalBrandsCount > 0 ? totalItemsCount / totalBrandsCount : 0;

          return {
               total_brands: totalBrandsCount,
               total_items: totalItemsCount,
               average_items_per_brand: Math.round(averageItemsPerBrand * 100) / 100
          };
     }
}