export type BillingAnalyticsNumber = number | string;

export interface BillingSalesMetrics {
     gross_revenue: BillingAnalyticsNumber;
     cash_collected: BillingAnalyticsNumber;
     earned_revenue: BillingAnalyticsNumber;
     discount: BillingAnalyticsNumber;
     outstanding?: BillingAnalyticsNumber;
     total_refunded: BillingAnalyticsNumber;
}

export interface BillingBranchSalesAnalytics extends BillingSalesMetrics {
     branchid: number;
     name: string;
}

export interface BillingOrganizationSalesAnalytics extends BillingSalesMetrics {
     organizationId: number | null;
     name: string | null;
     organization_services_count: number;
     nhis_services_count: number;
     total_services_rendered: number;
}

export interface BillingOutsourcedStatusAnalytics extends BillingSalesMetrics {
     isoutsourced: boolean | number | null;
}

export interface BillingBranchCategorySalesAnalytics extends BillingSalesMetrics {
     branchid: number;
     serviceCategory: string | null;
}

export interface BillingEmployeeSalesAnalytics extends BillingSalesMetrics {
     employeeid: number | null;
     status: string | null;
     totalServicesRendered: number;
     username: string | null;
}

export interface BillingClinicianSalesAnalytics extends BillingSalesMetrics {
     clinicianId: number | null;
     status: string | null;
     totalServicesRendered: number;
     clinician_name?: string | null;
     name?: string | null;
}

export interface BillingMonthlySalesTrend extends BillingSalesMetrics {
     month: string;
     expenses_paid?: BillingAnalyticsNumber;
     net_operating_cash?: BillingAnalyticsNumber;
}

export interface BillingDailySalesTrend extends BillingSalesMetrics {
     date: string;
     expenses_paid?: BillingAnalyticsNumber;
     net_operating_cash?: BillingAnalyticsNumber;
}

export interface BillingWeeklySalesTrend extends BillingSalesMetrics {
     week: number;
     expenses_paid: BillingAnalyticsNumber;
     net_operating_cash: BillingAnalyticsNumber;
}

export interface BillingYearlySalesTrend extends BillingSalesMetrics {
     year: number;
     expenses_paid?: BillingAnalyticsNumber;
     net_operating_cash?: BillingAnalyticsNumber;
}

export interface BillingWeeklyBranchSalesAnalytics extends BillingSalesMetrics {
     week: number;
     branchid: number;
     name: string;
}

export interface BillingRefundAnalytics {
     total_refunded: BillingAnalyticsNumber;
}

export interface BillingAnalyticsResultMap {
     totalSalesByBranch: BillingBranchSalesAnalytics[];
     totalSalesByOrganization: BillingOrganizationSalesAnalytics[];
     totalSalesByOutsourcedStatus: BillingOutsourcedStatusAnalytics[];
     totalSalesByBranchAndCategory: BillingBranchCategorySalesAnalytics[];
     totalSalesByEmployee: BillingEmployeeSalesAnalytics[];
     totalSalesByClinician: BillingClinicianSalesAnalytics[];
     monthlySalesTrend: BillingMonthlySalesTrend[];
     dailySalesTrend: BillingDailySalesTrend[];
     weeklySalesTrend: BillingWeeklySalesTrend[];
     salesByWeekAndBranch: BillingWeeklyBranchSalesAnalytics[];
     yearlySalesTrend: BillingYearlySalesTrend[];
     totalAmountRefunded: BillingRefundAnalytics[];
}

export type BillingAnalyticsKey = keyof BillingAnalyticsResultMap;

export type BillingAnalyticsResult<K extends BillingAnalyticsKey> = BillingAnalyticsResultMap[K];
