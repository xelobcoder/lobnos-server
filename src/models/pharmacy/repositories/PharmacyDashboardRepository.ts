import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { IPharmacyDashboardRepository, PharmacyDashboardData } from '../interfaces/IPharmacyDashboardRepository';

export class PharmacyDashboardRepository implements IPharmacyDashboardRepository {
     private readonly connection: Promise<Knex>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getDashboard(): Promise<PharmacyDashboardData> {
          const connection = await this.connection;
          const [todayResult, recentSales, lowStockResult] = await Promise.all([
               connection('pharmacy_sales').where('status', 'completed').whereRaw('DATE(completed_at) = CURDATE()').select(connection.raw('COUNT(*) as saleCount'), connection.raw('COALESCE(SUM(total_amount), 0) as revenue')).first(),
               connection('pharmacy_sales').where('status', 'completed').orderBy('completed_at', 'desc').limit(5),
               connection('inv_inventory_items as item').where('item.inventory_domain', 'pharmacy').where('item.is_active', true).whereRaw('item.current_stock <= item.min_stock').count('* as count').first()
          ]);
          const today = todayResult as { saleCount?: number | string; revenue?: number | string } | undefined;
          return {
               todaySales: Number(today?.revenue || 0),
               completedSales: Number(today?.saleCount || 0),
               lowStockItems: Number(lowStockResult?.count || 0),
               recentSales: recentSales.map((sale: any) => ({ receiptNumber: sale.receipt_number, customerName: sale.customer_name, paymentMethod: sale.payment_method, total: Number(sale.total_amount), completedAt: sale.completed_at }))
          };
     }
}