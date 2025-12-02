import { Knex } from 'knex';
import {
     InventoryTemplate,
     CreateInventoryTemplateRequest,
     UpdateInventoryTemplateRequest,
     InventoryTemplateListResponse,
     InventoryTemplateFilters,
     InventoryTemplateItem,
     CreateInventoryTemplateItemRequest,
     UpdateInventoryTemplateItemRequest
} from './types';
import KnexConnection from '../../database/KnexConnections';
import Operations from '../operations/operations';

export class InventoryTemplateModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(request: CreateInventoryTemplateRequest, createdBy: number): Promise<InventoryTemplate> {
          const connection = await this.connection;

          return await connection.transaction(async (trx) => {
               // Validate template name uniqueness
               const existingTemplate = await trx('inv_inventory_templates')
                    .where('name', request.name)
                    .first();

               if (existingTemplate) {
                    throw new Error('Template name already exists');
               }

               const templateData = {
                    name: request.name,
                    createby: createdBy,
                    description: request.description || null,
                    testId: request.testId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
               };

               const [templateId] = await trx('inv_inventory_templates').insert(templateData);

               // Create template items
               if (request.items && request.items.length > 0) {
                    const itemData = request.items.map(item => ({
                         template_id: templateId,
                         itemId: item.itemId,
                         quantity: item.quantity,
                         created_at: new Date().toISOString()
                    }));

                    await trx('inv_inventory_template_items').insert(itemData);
               }

               // Fetch the created template with joined data
               const result = await trx('inv_inventory_templates')
                    .leftJoin('roles', 'inv_inventory_templates.createby', 'roles.employeeid')
                    .select(
                         'inv_inventory_templates.*',
                         'roles.username as creator_name'
                    )
                    .where('inv_inventory_templates.id', templateId)
                    .first();

               // Get items count
               const itemsCount = await trx('inv_inventory_template_items')
                    .where('template_id', templateId)
                    .count('* as count')
                    .first();

               return {
                    id: result.id,
                    name: result.name,
                    createby: result.createby,
                    description: result.description,
                    testId: result.testId,
                    created_at: result.created_at,
                    updated_at: result.updated_at,
                    creator_name: result.creator_name,
                    items_count: parseInt((itemsCount as any)?.count || 0)
               };
          });
     }

     async findById(id: number): Promise<InventoryTemplate | null> {
          const connection = await this.connection;
          const result = await connection('inv_inventory_templates')
               .leftJoin('roles', 'inv_inventory_templates.createby', 'roles.employeeid')
               .select(
                    'inv_inventory_templates.*',
                    'roles.username as creator_name'
               )
               .where('inv_inventory_templates.id', id)
               .first();

          if (!result) return null;

          // Get items count
          const itemsCount = await connection('inv_inventory_template_items')
               .where('template_id', id)
               .count('* as count')
               .first();

          return {
               id: result.id,
               name: result.name,
               createby: result.createby,
               description: result.description,
               testId: result.testId,
               created_at: result.created_at,
               updated_at: result.updated_at,
               creator_name: result.creator_name,
               items_count: parseInt((itemsCount as any)?.count || 0)
          };
     }

     async findByTestId(testId: string, includeItems?: boolean, ascensionid?: number): Promise<InventoryTemplate | null> {
          const connection = await this.connection;
          const result = await connection('inv_inventory_templates')
               .leftJoin('roles', 'inv_inventory_templates.createby', 'roles.employeeid')
               .select(
                    'inv_inventory_templates.*',
                    'roles.username as creator_name'
               )
               .where('inv_inventory_templates.testId', testId)
               .first();

          if (!result) return null;

          // Get items count
          const itemsCount = await connection('inv_inventory_template_items')
               .where('template_id', result.id)
               .count('* as count')

          if (includeItems) {
               const items = await this.getTemplateItems(result.id);
               // check if items are consumed based on ascensionid
               for (const item of items) {
                    await this.checkAscensionItemCompletionStatus(item, ascensionid, true);
               }

               return {
                    id: result.id,
                    name: result.name,
                    createby: result.createby,
                    description: result.description,
                    testId: result.testId,
                    created_at: result.created_at,
                    updated_at: result.updated_at,
                    creator_name: result.creator_name,
                    items_count: parseInt((items.length || 0).toString()),
                    items: items.map((item: any) => ({
                         id: item.id,
                         template_id: item.template_id,
                         itemId: item.itemId,
                         quantity: parseFloat(item.quantity),
                         created_at: item.created_at,
                         item_name: item.item_name,
                         item_sku: item.item_sku,
                         unit: item.unit,
                         is_consumed: item.is_consumed || false,
                         quantity_remaining: item.quantity_remaining || parseFloat(item.quantity.toString()),
                         status: item.status
                    }))
               };
          }


          return {
               id: result.id,
               name: result.name,
               createby: result.createby,
               description: result.description,
               testId: result.testId,
               created_at: result.created_at,
               updated_at: result.updated_at,
               creator_name: result.creator_name,
               items_count: parseInt((itemsCount as any)?.count || 0)
          };
     }

     private async checkAscensionItemCompletionStatus(item: InventoryTemplateItem, ascensionid: number, checkQtyRemaining: boolean = false) {
          const connection = await this.connection;
          const consumptionRecord = await connection('inv_inventory_transactions')
               .where('item_id', item.itemId)
               .andWhere('ascension_id', ascensionid)
               .first();
          item.is_consumed = !!consumptionRecord;
          if (checkQtyRemaining && consumptionRecord) {
               const quantityConsumed = parseFloat(consumptionRecord.quantity);
               item.quantity_remaining = parseFloat(item.quantity.toString()) - quantityConsumed
               item.status = item.quantity_remaining === 0 ? 'completed' : (item.quantity_remaining < parseFloat(item.quantity.toString()) ? 'partial' : 'pending');
          }

          return item;
     }

     async findMany(filters: InventoryTemplateFilters): Promise<InventoryTemplateListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               testId,
               search,
               createby
          } = filters;

          let query = connection('inv_inventory_templates')
               .leftJoin('roles', 'inv_inventory_templates.createby', 'roles.employeeid')
               .select(
                    'inv_inventory_templates.*',
                    'roles.username as creator_name'
               )
               .orderBy('inv_inventory_templates.created_at', sortby);

          // Apply filters
          if (testId) {
               query = query.where('inv_inventory_templates.testId', testId);
          }
          if (createby) {
               query = query.where('inv_inventory_templates.createby', createby);
          }
          if (search) {
               query = query.where((qb) => {
                    qb.where('inv_inventory_templates.name', 'like', `%${search}%`)
                         .orWhere('inv_inventory_templates.description', 'like', `%${search}%`)
                         .orWhere('inv_inventory_templates.testId', 'like', `%${search}%`);
               });
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const templates = await Promise.all(rawData.map(async (result: any) => {
               // Get items count for each template
               const itemsCount = await connection('inv_inventory_template_items')
                    .where('template_id', result.id)
                    .count('* as count')
                    .first();

               return {
                    id: result.id,
                    name: result.name,
                    createby: result.createby,
                    description: result.description,
                    testId: result.testId,
                    created_at: result.created_at,
                    updated_at: result.updated_at,
                    creator_name: result.creator_name,
                    items_count: parseInt((itemsCount as any)?.count || 0)
               };
          }));

          return {
               templates,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count),
               sortby
          };
     }

     async update(id: number, updates: UpdateInventoryTemplateRequest): Promise<InventoryTemplate | null> {
          const connection = await this.connection;

          return await connection.transaction(async (trx) => {
               const currentTemplate = await trx('inv_inventory_templates')
                    .leftJoin('roles', 'inv_inventory_templates.createby', 'roles.employeeid')
                    .select(
                         'inv_inventory_templates.*',
                         'roles.username as creator_name'
                    )
                    .where('inv_inventory_templates.id', id)
                    .first();

               if (!currentTemplate) {
                    throw new Error('Inventory template not found');
               }

               // Validate name uniqueness if changing
               if (updates.name && updates.name !== currentTemplate.name) {
                    const existingTemplate = await trx('inv_inventory_templates')
                         .where('name', updates.name)
                         .whereNot('id', id)
                         .first();

                    if (existingTemplate) {
                         throw new Error('Template name already exists');
                    }
               }

               const updateData: any = {
                    updated_at: new Date().toISOString()
               };

               if (updates.name !== undefined) updateData.name = updates.name;
               if (updates.description !== undefined) updateData.description = updates.description;
               if (updates.testId !== undefined) updateData.testId = updates.testId;

               await trx('inv_inventory_templates')
                    .where({ id })
                    .update(updateData);

               // Update items if provided
               if (updates.items) {
                    // Delete existing items
                    await trx('inv_inventory_template_items')
                         .where('template_id', id)
                         .del();

                    // Insert new items
                    if (updates.items.length > 0) {
                         const itemData = updates.items.map(item => ({
                              template_id: id,
                              itemId: item.itemId,
                              quantity: item.quantity,
                              created_at: new Date().toISOString()
                         }));

                         await trx('inv_inventory_template_items').insert(itemData);
                    }
               }

               // Fetch updated template with joined data
               const result = await trx('inv_inventory_templates')
                    .leftJoin('roles', 'inv_inventory_templates.createby', 'roles.employeeid')
                    .select(
                         'inv_inventory_templates.*',
                         'roles.username as creator_name'
                    )
                    .where('inv_inventory_templates.id', id)
                    .first();

               // Get items count
               const itemsCount = await trx('inv_inventory_template_items')
                    .where('template_id', id)
                    .count('* as count')
                    .first();

               return {
                    id: result.id,
                    name: result.name,
                    createby: result.createby,
                    description: result.description,
                    testId: result.testId,
                    created_at: result.created_at,
                    updated_at: result.updated_at,
                    creator_name: result.creator_name,
                    items_count: parseInt((itemsCount as any)?.count || 0)
               };
          });
     }

     async delete(id: number): Promise<boolean> {
          const connection = await this.connection;

          return await connection.transaction(async (trx) => {
               const template = await trx('inv_inventory_templates')
                    .where('id', id)
                    .first();

               if (!template) {
                    return false;
               }

               // Delete template items first (cascade should handle this, but being explicit)
               await trx('inv_inventory_template_items')
                    .where('template_id', id)
                    .del();

               const result = await trx('inv_inventory_templates')
                    .where({ id })
                    .del();

               return result > 0;
          });
     }

     async getTemplateItems(templateId: number): Promise<InventoryTemplateItem[]> {
          const connection = await this.connection;

          const results = await connection('inv_inventory_template_items')
               .leftJoin('inv_inventory_items', 'inv_inventory_template_items.itemId', 'inv_inventory_items.id')
               .select(
                    'inv_inventory_template_items.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku',
                    'inv_inventory_items.unit'
               )
               .where('inv_inventory_template_items.template_id', templateId)
               .orderBy('inv_inventory_template_items.created_at', 'asc');

          return results.map((result: any) => ({
               id: result.id,
               template_id: result.template_id,
               itemId: result.itemId,
               quantity: parseFloat(result.quantity),
               created_at: result.created_at,
               item_name: result.item_name,
               item_sku: result.item_sku,
               unit: result.unit
          }));
     }

     async addTemplateItem(templateId: number, item: CreateInventoryTemplateItemRequest): Promise<InventoryTemplateItem> {
          const connection = await this.connection;

          return await connection.transaction(async (trx) => {
               // Validate template exists
               const template = await trx('inv_inventory_templates')
                    .where('id', templateId)
                    .first();

               if (!template) {
                    throw new Error('Inventory template not found');
               }

               // Validate item exists
               const inventoryItem = await trx('inv_inventory_items')
                    .where('id', item.itemId)
                    .first();

               if (!inventoryItem) {
                    throw new Error('Inventory item not found');
               }

               const itemData = {
                    template_id: templateId,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    created_at: new Date().toISOString()
               };

               const [itemId] = await trx('inv_inventory_template_items').insert(itemData);

               // Get the created item with joined data
               const result = await trx('inv_inventory_template_items')
                    .leftJoin('inv_inventory_items', 'inv_inventory_template_items.itemId', 'inv_inventory_items.id')
                    .select(
                         'inv_inventory_template_items.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'inv_inventory_items.unit'
                    )
                    .where('inv_inventory_template_items.id', itemId)
                    .first();

               return {
                    id: result.id,
                    template_id: result.template_id,
                    itemId: result.itemId,
                    quantity: parseFloat(result.quantity),
                    created_at: result.created_at,
                    item_name: result.item_name,
                    item_sku: result.item_sku,
                    unit: result.unit
               };
          });
     }

     async updateTemplateItem(templateId: number, itemId: number, updates: UpdateInventoryTemplateItemRequest): Promise<InventoryTemplateItem | null> {
          const connection = await this.connection;

          return await connection.transaction(async (trx) => {
               const updateData: any = {};

               if (updates.itemId !== undefined) {
                    // Validate new item exists
                    const inventoryItem = await trx('inv_inventory_items')
                         .where('id', updates.itemId)
                         .first();

                    if (!inventoryItem) {
                         throw new Error('Inventory item not found');
                    }
                    updateData.itemId = updates.itemId;
               }

               if (updates.quantity !== undefined) updateData.quantity = updates.quantity;

               if (Object.keys(updateData).length === 0) {
                    throw new Error('No updates provided');
               }

               const result = await trx('inv_inventory_template_items')
                    .where({ id: itemId, template_id: templateId })
                    .update(updateData);

               if (result === 0) return null;

               // Get updated item
               const updatedResult = await trx('inv_inventory_template_items')
                    .leftJoin('inv_inventory_items', 'inv_inventory_template_items.itemId', 'inv_inventory_items.id')
                    .select(
                         'inv_inventory_template_items.*',
                         'inv_inventory_items.name as item_name',
                         'inv_inventory_items.sku as item_sku',
                         'inv_inventory_items.unit'
                    )
                    .where('inv_inventory_template_items.id', itemId)
                    .first();

               if (!updatedResult) return null;

               return {
                    id: updatedResult.id,
                    template_id: updatedResult.template_id,
                    itemId: updatedResult.itemId,
                    quantity: parseFloat(updatedResult.quantity),
                    created_at: updatedResult.created_at,
                    item_name: updatedResult.item_name,
                    item_sku: updatedResult.item_sku,
                    unit: updatedResult.unit
               };
          });
     }

     async removeTemplateItem(templateId: number, itemId: number): Promise<boolean> {
          const connection = await this.connection;

          return await connection.transaction(async (trx) => {
               const result = await trx('inv_inventory_template_items')
                    .where({ id: itemId, template_id: templateId })
                    .del();

               return result > 0;
          });
     }

     async getTemplatesByTestIds(testIds: string[]): Promise<InventoryTemplate[]> {
          const connection = await this.connection;

          const results = await connection('inv_inventory_templates')
               .leftJoin('roles', 'inv_inventory_templates.createby', 'roles.employeeid')
               .select(
                    'inv_inventory_templates.*',
                    'roles.username as creator_name'
               )
               .whereIn('inv_inventory_templates.testId', testIds)
               .orderBy('inv_inventory_templates.created_at', 'desc');

          return await Promise.all(results.map(async (result: any) => {
               // Get items count for each template
               const itemsCount = await connection('inv_inventory_template_items')
                    .where('template_id', result.id)
                    .count('* as count')
                    .first();

               return {
                    id: result.id,
                    name: result.name,
                    createby: result.createby,
                    description: result.description,
                    testId: result.testId,
                    created_at: result.created_at,
                    updated_at: result.updated_at,
                    creator_name: result.creator_name,
                    items_count: parseInt((itemsCount as any)?.count || 0)
               };
          }));
     }


     async ascensionConsumptionStatus(ascension_id: number, testid: number): Promise<{ status: InventoryTemplateItem['status'] }> {
          const data = await this.findByTestId(testid.toString(), true, ascension_id);
          const items = data?.items;
          if(!items) return { status: "unknown-template" };     
          if (items.length === 0) return { status: "pending" };
          const allCompleted = items.every(item => item.status === 'completed');
          const anyPartial = items.some(item => item.status === 'partial');
          return allCompleted ? { status: 'completed' } : (anyPartial ? { status: 'partial' } : { status: 'pending' });
     }


     async getAscensionDirectConsumption(tenantId: number, queryParams: {
          sortby: 'DESC' | 'ASC', _dateFrom: Date | string, _dateEnd: Date | string, stage: string,
          searchString: string, page: number, count: number, isUltrasound: boolean, clinicianId: number, organizationId: number
     }) {
          let list = await Operations.getAscensionBasedOnStage(tenantId, queryParams);
          if (list && Array.isArray(list)) {
               for (const item of list) {
                    const { ascensionid, id } = item;
                    const consumptionStatus = await this.ascensionConsumptionStatus(ascensionid, id);
                    item.consumption_status = consumptionStatus.status;
               }
               return list;
          }
          return [];
     }
}

export default InventoryTemplateModel;
