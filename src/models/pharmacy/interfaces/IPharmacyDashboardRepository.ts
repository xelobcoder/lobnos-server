export interface PharmacyDashboardSale {
     receiptNumber: string;
     customerName: string;
     paymentMethod: string;
     total: number;
     completedAt: Date;
}

export interface PharmacyDashboardData {
     todaySales: number;
     completedSales: number;
     lowStockItems: number;
     recentSales: PharmacyDashboardSale[];
}

export interface IPharmacyDashboardRepository {
     /** Returns pharmacy sales and inventory indicators for the authenticated tenant. */
     getDashboard(): Promise<PharmacyDashboardData>;
}