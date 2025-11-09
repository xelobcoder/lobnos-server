import { Knex } from 'knex';
import {
     Category,
     CreateCategoryRequest,
     UpdateCategoryRequest,
     CategoryListResponse
} from './types';
import KnexConnection from '../../database/KnexConnections';

export class CategoryModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private generateCategoryId(): string {
          const timestamp = Date.now().toString();
          return `CAT-${timestamp}`;
     }

     async create(request: CreateCategoryRequest): Promise<Category> {
          const connection = await this.connection;

          // Check if category name already exists
          const existing = await connection('inv_categories')
               .where('name', request.name)
               .first();

          if (existing) {
               throw new Error('Category name already exists');
          }

          const categoryData = {
               id: this.generateCategoryId(),
               name: request.name,
               description: request.description || null,
               item_count: 0,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
          };

          await connection('inv_categories').insert(categoryData);

          return {
               id: categoryData.id,
               name: categoryData.name,
               description: categoryData.description,
               item_count: categoryData.item_count,
               created_at: categoryData.created_at,
               updated_at: categoryData.updated_at
          };
     }

     async findById(id: string): Promise<Category | null> {
          const connection = await this.connection;
          const result = await connection('inv_categories')
               .where('id', id)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               description: result.description,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          };
     }

     async findByName(name: string): Promise<Category | null> {
          const connection = await this.connection;
          const result = await connection('inv_categories')
               .where('name', name)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               description: result.description,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          };
     }

     async findMany(page: number = 1, count: number = 10, search?: string, sortby: 'ASC' | 'DESC' = 'ASC'): Promise<CategoryListResponse> {
          const connection = await this.connection;

          let query = connection('inv_categories')
               .orderBy('name', sortby.toLowerCase() as 'asc' | 'desc');

          if (search) {
               query = query.where('name', 'like', `%${search}%`)
                    .orWhere('description', 'like', `%${search}%`);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const categories = rawData.map((result: any) => ({
               id: result.id,
               name: result.name,
               description: result.description,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));

          return {
               categories,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count),
               sortby
          };
     }

     async update(id: string, updates: UpdateCategoryRequest): Promise<Category | null> {
          const connection = await this.connection;

          const currentCategory = await this.findById(id);
          if (!currentCategory) {
               throw new Error('Category not found');
          }

          if (updates.name && updates.name !== currentCategory.name) {
               // Check if new name already exists
               const existing = await connection('inv_categories')
                    .where('name', updates.name)
                    .whereNot('id', id)
                    .first();

               if (existing) {
                    throw new Error('Category name already exists');
               }
          }

          const updateData: any = {
               updated_at: new Date().toISOString()
          };

          if (updates.name !== undefined) updateData.name = updates.name;
          if (updates.description !== undefined) updateData.description = updates.description;

          await connection('inv_categories')
               .where({ id })
               .update(updateData);

          return await this.findById(id);
     }

     async delete(id: string): Promise<boolean> {
          const connection = await this.connection;

          // Check if category is in use
          const category = await this.findById(id);
          if (!category) {
               return false;
          }

          if (category.item_count > 0) {
               throw new Error('Cannot delete category in use');
          }

          const result = await connection('inv_categories')
               .where({ id })
               .del();

          return result > 0;
     }

     async getAll(): Promise<Category[]> {
          const connection = await this.connection;
          const results = await connection('inv_categories')
               .orderBy('name', 'ASC');

          return results.map((result: any) => ({
               id: result.id,
               name: result.name,
               description: result.description,
               item_count: result.item_count,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));
     }
}