/**
 * Interface representing an Organization with sales-related methods.
 */
interface IOrganization {
  /**
   * Retrieves monthly sales data for the organization.
   * @returns Promise<any> representing monthly sales data.
   */
  monthSales(): Promise<any>;

  /**
   * Retrieves daily sales data for the organization.
   * @returns Promise<any> representing daily sales data.
   */
  daySales(): Promise<any>;

  /**
   * Retrieves weekly sales data for the organization.
   * @returns Promise<any[]> representing weekly sales data.
   */
  weeklySales(): Promise<any[]>;

  /**
   * Retrieves yearly sales data for the organization.
   * @returns Promise<any> representing yearly sales data.
   */
  getYearlySales(): Promise<any>;

  /**
   * Retrieves daily sales data with commission rate calculation.
   * @returns Promise<any[]> representing daily sales data.
   */
  getDailySales(): Promise<any[]>;

  /**
   * Generates a sales report for the organization.
   * @returns Promise<any> representing the generated sales report.
   */
  generateSalesReport(): Promise<any>;
}
