import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { IPharmacyDashboardRepository, PharmacyDashboardData } from '../interfaces/IPharmacyDashboardRepository';

export class PharmacyDashboardRepository implements IPharmacyDashboardRepository {
     private readonly connection: Promise<Knex>;

     constructor(tenantId: number,private readonly branchId:number|null=null) {
          this.connection = KnexConnection(tenantId);
     }

     async getDashboard(): Promise<PharmacyDashboardData> {
          const connection = await this.connection;
          const sales=connection('pharmacy_sales');const payments=connection('pharmacy_payments').whereIn('sale_id',connection('pharmacy_sales').select('id').where('accounting_version',2));
          if(this.branchId!=null){sales.where('branchid',this.branchId);payments.where('branchid',this.branchId);}
          const [todayResult, refundResult, recentSales, lowStockResult] = await Promise.all([
               payments.clone().whereRaw('DATE(collected_at) = CURDATE()').select(connection.raw('COUNT(*) as saleCount'), connection.raw('COALESCE(SUM(amount), 0) as revenue')).first(),
               payments.clone().where('status','refunded').whereRaw('DATE(reversed_at) = CURDATE()').sum('amount as amount').first(),
               sales.clone().where('status', 'completed').orderBy('completed_at', 'desc').limit(5),
               connection('pharmacy_inventory_items as item').where('item.branchid', this.branchId ?? -1).where('item.is_active', true).whereRaw('item.current_stock <= item.min_stock').count('* as count').first()
          ]);
          const today = todayResult as { saleCount?: number | string; revenue?: number | string } | undefined;
          return {
               todaySales: Number((Number(today?.revenue || 0)-Number(refundResult?.amount||0)).toFixed(2)),
               completedSales: Number(today?.saleCount || 0),
               lowStockItems: Number(lowStockResult?.count || 0),
               recentSales: recentSales.map((sale: any) => ({ receiptNumber: sale.receipt_number, customerName: sale.customer_name, paymentMethod: sale.payment_method, total: Number(sale.total_amount), completedAt: sale.completed_at }))
          };
     }
}
