import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import {
     LOW_STOCK_CONDITION,
     PHARMACY_DEFAULT_PAGE_SIZE,
     PHARMACY_DEFAULT_SORT_DIRECTION,
     PHARMACY_DEFAULT_SORT_FIELD,
     PHARMACY_MAX_PAGE_SIZE,
     PHARMACY_SORT_COLUMNS
} from '../constants/pharmacy.constants';
import { resolveStockStatus } from '../entities/PharmacyStock';
import {
     IPharmacyCatalogueRepository,
     PharmacyCatalogueFilters,
     PharmacyCatalogueItem,
     PharmacyCataloguePage,
     PharmacyCataloguePageRequest,
     PharmacyStockSummary
} from '../interfaces/IPharmacyCatalogueRepository';

export class PharmacyCatalogueRepository implements IPharmacyCatalogueRepository {
     private readonly connection: Promise<Knex>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async findPage(request: PharmacyCataloguePageRequest = {}): Promise<PharmacyCataloguePage> {
          const connection = await this.connection;
          const page = Math.max(1, Number(request.page) || 1);
          const count = Math.min(PHARMACY_MAX_PAGE_SIZE, Math.max(1, Number(request.count) || PHARMACY_DEFAULT_PAGE_SIZE));
          const { column, direction } = this.resolveSort(request);

          const [rows, totalResult] = await Promise.all([
               this.buildQuery(connection, request)
                    .select(this.columns())
                    .orderBy(column, direction)
                    .limit(count)
                    .offset((page - 1) * count),
               this.buildQuery(connection, request)
                    .count('* as total').first()
          ]);

          return { items: rows.map((row: any) => this.toCatalogueItem(row)), total: Number((totalResult as any)?.total || 0) };
     }

     async summarise(filters: PharmacyCatalogueFilters = {}): Promise<PharmacyStockSummary> {
          const connection = await this.connection;
          const result = await this.buildQuery(connection, filters)
               .select(
                    connection.raw('COUNT(*) AS totalItems'),
                    connection.raw('SUM(CASE WHEN item.current_stock <= 0 THEN 1 ELSE 0 END) AS outOfStock'),
                    connection.raw(`SUM(CASE WHEN item.current_stock > 0 AND ${LOW_STOCK_CONDITION} THEN 1 ELSE 0 END) AS lowStock`),
                    connection.raw(`SUM(CASE WHEN NOT (${LOW_STOCK_CONDITION}) THEN 1 ELSE 0 END) AS inStock`)
               )
               .first();

          return {
               totalItems: Number((result as any)?.totalItems || 0),
               inStock: Number((result as any)?.inStock || 0),
               lowStock: Number((result as any)?.lowStock || 0),
               outOfStock: Number((result as any)?.outOfStock || 0)
          };
     }

     private resolveSort(request: PharmacyCataloguePageRequest): { column: string; direction: 'asc' | 'desc' } {
          const column = PHARMACY_SORT_COLUMNS[request.sortBy as keyof typeof PHARMACY_SORT_COLUMNS] ?? PHARMACY_SORT_COLUMNS[PHARMACY_DEFAULT_SORT_FIELD];
          const direction = String(request.sortDirection).toLowerCase() === 'desc' ? 'desc' : PHARMACY_DEFAULT_SORT_DIRECTION;
          return { column, direction };
     }

     private buildQuery(connection: Knex, filters: PharmacyCatalogueFilters): Knex.QueryBuilder {
          let query = connection('inv_inventory_items as item')
               .where('item.is_active', true)
               .where('item.inventory_domain', 'pharmacy');

          if (filters.sellableOnly) {
               query = query.where('item.current_stock', '>', 0).where('item.sale_price', '>', 0);
          }
          if (filters.lowStockOnly) {
               query = query.whereRaw(LOW_STOCK_CONDITION);
          }
          if (filters.search?.trim()) {
               const term = `%${filters.search.trim()}%`;
               query = query.where((builder) => builder.where('item.name', 'like', term).orWhere('item.sku', 'like', term));
          }
          return query;
     }

     private columns(): string[] {
          return [
               'item.id as inventory_item_id',
               'item.sku',
               'item.name',
               'item.consumption_unit',
               'item.current_stock',
               'item.min_stock',
               'item.wholesale_price',
               'item.sale_price'
          ];
     }

     private toCatalogueItem(row: any): PharmacyCatalogueItem {
          const availableStock = Number(row.current_stock || 0);
          const minimumStock = Number(row.min_stock || 0);
          return {
               inventoryItemId: row.inventory_item_id,
               sku: row.sku,
               name: row.name,
               unit: row.consumption_unit,
               availableStock,
               minimumStock,
               wholesalePrice: Number(row.wholesale_price || 0),
               salePrice: Number(row.sale_price || 0),
               stockStatus: resolveStockStatus(availableStock, minimumStock)
          };
     }
}