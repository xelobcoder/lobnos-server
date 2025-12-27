import KnexConnection from "../../database/KnexConnections";

export interface ItemAnalyticsSummary {
  total_orders_received: number;
  total_quantity_received: number;
  total_amount_received: number;
  total_consumed_quantity: number;
  total_consumed_amount: number;
  total_wasted_quantity: number;
  total_wasted_amount: number;
  average_daily_consumption_quantity: number;
  average_daily_consumption_amount: number;
  supplier_count: number;
  test_consumption_variance_percent: number;
}

export interface PeriodAnalytics {
  period: string;
  period_type: 'daily' | 'monthly' | 'yearly';
  quantity: number;
  amount: number;
}

export interface SupplierAnalytics {
  supplier_id: string;
  supplier_name: string;
  period?: string;
  period_type?: 'daily' | 'monthly' | 'yearly';
  quantity: number;
  amount: number;
}

export interface SupplierPerformanceMetrics {
  supplier_id: string;
  supplier_name: string;
  total_deliveries: number;
  total_quantity_received: number;
  total_amount: number;
  avg_lead_time_days: number;
  min_lead_time_days: number;
  max_lead_time_days: number;
  on_time_delivery_rate_percent: number;
  rejection_rate_percent: number;
  failed_qc_count: number;
  price_stability_stddev: number;
  dependency_risk_percent: number;
  is_single_source: boolean;
}

export interface TestConsumptionAnalytics {
  period?: string;
  period_type?: 'daily' | 'monthly' | 'yearly';
  test_id: number;
  test_name: string;
  completed_tests_count: number;
  expected_consumption_quantity: number;
  actual_consumption_quantity_linked: number;
  variance_quantity: number;
  actual_vs_expected_percent: number;
}

export interface AverageConsumption {
  average_daily_consumption_quantity: number;
  average_daily_consumption_amount: number;
}

export class InventoryItemAnalyticsModel {
  constructor(private tenantId: number) { }

  private async getConnection() {
    return await KnexConnection(this.tenantId);
  }

  async getItemAnalyticsSummary(itemId: string, startDate?: string, endDate?: string): Promise<ItemAnalyticsSummary> {
    const connection = await this.getConnection();

    // Get total orders received
    const ordersQuery = connection('inv_purchase_order_receipts as r')
      .join('inv_purchase_order_items as poi', 'r.order_item_id', 'poi.id')
      .where('poi.inventory_item_id', itemId)
      .andWhere(function () {
        if (startDate) this.where('r.received_date', '>=', startDate);
        if (endDate) this.where('r.received_date', '<=', endDate);
      });

    const ordersResult = await ordersQuery
      .select(
        connection.raw('COUNT(*) as total_orders'),
        connection.raw('SUM(r.quantity_received) as total_quantity'),
        connection.raw('SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) as total_amount')
      )
      .first();

    // Get total consumption
    const consumptionQuery = connection('inv_inventory_transactions as t')
      .where('t.item_id', itemId)
      .where('t.transaction_type', 'consumption')
      .andWhere(function () {
        if (startDate) this.where('t.transaction_date', '>=', startDate);
        if (endDate) this.where('t.transaction_date', '<=', endDate);
      });

    const consumptionResult = await consumptionQuery
      .select(
        connection.raw('SUM(t.quantity) as total_quantity'),
        connection.raw('SUM(COALESCE(t.total_cost, 0)) as total_amount')
      )
      .first();

    // Get total wastage
    const wastageQuery = connection('inv_inventory_transactions as t')
      .where('t.item_id', itemId)
      .where('t.transaction_type', 'wastage')
      .andWhere(function () {
        if (startDate) this.where('t.transaction_date', '>=', startDate);
        if (endDate) this.where('t.transaction_date', '<=', endDate);
      });

    const wastageResult = await wastageQuery
      .select(
        connection.raw('SUM(t.quantity) as total_quantity'),
        connection.raw('SUM(COALESCE(t.total_cost, 0)) as total_amount')
      )
      .first();

    // Get average daily consumption
    const avgConsumptionResult = await connection.raw(`
            SELECT
                COALESCE(AVG(daily_quantity), 0) AS average_daily_consumption_quantity,
                COALESCE(AVG(daily_amount), 0) AS average_daily_consumption_amount
            FROM (
                SELECT
                    DATE(t.transaction_date) AS day,
                    SUM(t.quantity) AS daily_quantity,
                    SUM(COALESCE(t.total_cost, 0)) AS daily_amount
                FROM inv_inventory_transactions t
                WHERE t.item_id = ?
                  AND t.transaction_type = 'consumption'
                  ${startDate ? 'AND t.transaction_date >= ?' : ''}
                  ${endDate ? 'AND t.transaction_date <= ?' : ''}
                GROUP BY DATE(t.transaction_date)
            ) AS daily_consumption
        `, [itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])].filter(Boolean));

    // Get supplier count
    const supplierCountResult = await connection('inv_purchase_order_receipts as r')
      .join('inv_purchase_order_items as poi', 'r.order_item_id', 'poi.id')
      .join('inv_purchase_orders as po', 'r.order_id', 'po.id')
      .join('inv_suppliers as s', 'po.supplier_id', 's.id')
      .where('poi.inventory_item_id', itemId)
      .andWhere(function () {
        if (startDate) this.where('r.received_date', '>=', startDate);
        if (endDate) this.where('r.received_date', '<=', endDate);
      })
      .countDistinct('s.id as supplier_count')
      .first();

    // Get test consumption variance (simplified)
    const testConsumptionResult = await connection.raw(`
            SELECT
                ROUND(
                    CASE
                        WHEN SUM(iti.quantity) > 0
                        THEN 100.0 * COALESCE(SUM(txn.quantity), 0) / SUM(iti.quantity)
                        ELSE 0
                    END, 2
                ) AS actual_vs_expected_percent
            FROM inv_inventory_template_items iti
            JOIN inv_inventory_templates itpl ON iti.template_id = itpl.id
            JOIN test_ascension ta ON ta.testid = CAST(itpl.testId AS UNSIGNED)
                                      AND ta.resultEntryEnd IS NOT NULL
            JOIN dboservices ds ON ds.trackId = ta.testid
                               AND ds.billingid = ta.billingid
                               AND ds.categoryTrackId != 6
            LEFT JOIN inv_inventory_transactions txn
                   ON txn.ascensionid = ta.id
                  AND txn.item_id = iti.itemId
                  AND txn.transaction_type = 'consumption'
            WHERE iti.itemId = ?
              ${startDate ? 'AND ta.ascension_date >= ?' : ''}
              ${endDate ? 'AND ta.ascension_date <= ?' : ''}
        `, [itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])].filter(Boolean));

    return {
      total_orders_received: Number((ordersResult as any)?.total_orders) || 0,
      total_quantity_received: Number((ordersResult as any)?.total_quantity) || 0,
      total_amount_received: Number((ordersResult as any)?.total_amount) || 0,
      total_consumed_quantity: Number((consumptionResult as any)?.total_quantity) || 0,
      total_consumed_amount: Number((consumptionResult as any)?.total_amount) || 0,
      total_wasted_quantity: Number((wastageResult as any)?.total_quantity) || 0,
      total_wasted_amount: Number((wastageResult as any)?.total_amount) || 0,
      average_daily_consumption_quantity: Number(avgConsumptionResult[0][0]?.average_daily_consumption_quantity) || 0,
      average_daily_consumption_amount: Number(avgConsumptionResult[0][0]?.average_daily_consumption_amount) || 0,
      supplier_count: Number((supplierCountResult as any)?.supplier_count) || 0,
      test_consumption_variance_percent: Number(testConsumptionResult[0][0]?.actual_vs_expected_percent) || 0
    };
  }

  async getItemOrderAnalytics(itemId: string, startDate?: string, endDate?: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
                  SELECT DATE(r.received_date) AS period, 'daily' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
                  FROM inv_purchase_order_receipts r
                  JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
                  WHERE poi.inventory_item_id = ? ${startDate ? 'AND r.received_date >= ?' : ''} ${endDate ? 'AND r.received_date <= ?' : ''}
                  GROUP BY DATE(r.received_date)
                  UNION ALL
                  SELECT DATE_FORMAT(r.received_date, '%Y-%m') AS period, 'monthly' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
                  FROM inv_purchase_order_receipts r
                  JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
                  WHERE poi.inventory_item_id = ? ${startDate ? 'AND r.received_date >= ?' : ''} ${endDate ? 'AND r.received_date <= ?' : ''}
                  GROUP BY DATE_FORMAT(r.received_date, '%Y-%m')
                  UNION ALL
                  SELECT CONCAT(YEAR(r.received_date)) AS period, 'yearly' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
                  FROM inv_purchase_order_receipts r
                  JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
                  WHERE poi.inventory_item_id = ? ${startDate ? 'AND r.received_date >= ?' : ''} ${endDate ? 'AND r.received_date <= ?' : ''}
                  GROUP BY CONCAT(YEAR(r.received_date))
                  ORDER BY period`, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getDailyOrderAnalytics(itemId: string, startDate?: string, endDate?: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE(r.received_date) AS period, 'daily' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
FROM inv_purchase_order_receipts r
JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
WHERE poi.inventory_item_id = ? ${startDate ? 'AND r.received_date >= ?' : ''} ${endDate ? 'AND r.received_date <= ?' : ''}
GROUP BY DATE(r.received_date)
ORDER BY period DESC`, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getMonthlyOrderAnalytics(itemId: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE_FORMAT(r.received_date, '%Y-%m') AS period, 'monthly' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
FROM inv_purchase_order_receipts r
JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
WHERE poi.inventory_item_id = ?
GROUP BY DATE_FORMAT(r.received_date, '%Y-%m')
ORDER BY period DESC`, [itemId]);

    return results[0] || [];
  }

  async getYearlyOrderAnalytics(itemId: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
      SELECT CONCAT(YEAR(r.received_date)) AS period, 'yearly' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
      FROM inv_purchase_order_receipts r
      JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
      WHERE poi.inventory_item_id = ?
      GROUP BY CONCAT(YEAR(r.received_date))
      ORDER BY period DESC`, [itemId]);
    return results[0] || [];
  }

  async getItemUsageAnalytics(itemId: string, startDate?: string, endDate?: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE(t.transaction_date) AS period, 'daily' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'consumption' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY DATE(t.transaction_date)
UNION ALL
SELECT DATE_FORMAT(t.transaction_date, '%Y-%m') AS period, 'monthly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'consumption' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
UNION ALL
SELECT CONCAT(YEAR(t.transaction_date)) AS period, 'yearly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'consumption' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY CONCAT(YEAR(t.transaction_date))
ORDER BY period`, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getDailyConsumptionAnalytics(itemId: string, startDate?: string, endDate?: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE(t.transaction_date) AS period, 'daily' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'consumption' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY DATE(t.transaction_date)
ORDER BY period DESC`, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getMonthlyConsumptionAnalytics(itemId: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE_FORMAT(t.transaction_date, '%Y-%m') AS period, 'monthly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'consumption'
GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
ORDER BY period DESC`, [itemId]);

    return results[0] || [];
  }

  async getYearlyConsumptionAnalytics(itemId: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT CONCAT(YEAR(t.transaction_date)) AS period, 'yearly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'consumption'
GROUP BY CONCAT(YEAR(t.transaction_date))
ORDER BY period DESC`, [itemId]);

    return results[0] || [];
  }

  async getItemWastageAnalytics(itemId: string, startDate?: string, endDate?: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE(t.transaction_date) AS period, 'daily' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'wastage' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY DATE(t.transaction_date)
UNION ALL
SELECT DATE_FORMAT(t.transaction_date, '%Y-%m') AS period, 'monthly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'wastage' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
UNION ALL
SELECT CONCAT(YEAR(t.transaction_date)) AS period, 'yearly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'wastage' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY CONCAT(YEAR(t.transaction_date))
ORDER BY period`, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getDailyWastageAnalytics(itemId: string, startDate?: string, endDate?: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE(t.transaction_date) AS period, 'daily' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'wastage' ${startDate ? 'AND t.transaction_date >= ?' : ''} ${endDate ? 'AND t.transaction_date <= ?' : ''}
GROUP BY DATE(t.transaction_date)
ORDER BY period DESC`, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getMonthlyWastageAnalytics(itemId: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
SELECT DATE_FORMAT(t.transaction_date, '%Y-%m') AS period, 'monthly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
FROM inv_inventory_transactions t
WHERE t.item_id = ? AND t.transaction_type = 'wastage'
GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
ORDER BY period DESC`, [itemId]);

    return results[0] || [];
  }

  async getYearlyWastageAnalytics(itemId: string): Promise<PeriodAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
      SELECT CONCAT(YEAR(t.transaction_date)) AS period, 'yearly' AS period_type, SUM(t.quantity) AS quantity, SUM(COALESCE(t.total_cost, 0)) AS amount
      FROM inv_inventory_transactions t
      WHERE t.item_id = ? AND t.transaction_type = 'wastage'
      GROUP BY CONCAT(YEAR(t.transaction_date))
      ORDER BY period DESC`, [itemId]);

    return results[0] || [];
  }

  async getSupplierSpecificAnalytics(itemId: string, supplierId?: string, startDate?: string, endDate?: string): Promise<SupplierAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
          SELECT s.id AS supplier_id, s.name AS supplier_name, DATE(r.received_date) AS period, 'daily' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
          FROM inv_purchase_order_receipts r
          JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
          JOIN inv_purchase_orders po ON r.order_id = po.id
          JOIN inv_suppliers s ON po.supplier_id = s.id
          WHERE poi.inventory_item_id = ? ${supplierId ? 'AND s.id = ?' : ''} ${startDate ? 'AND r.received_date >= ?' : ''} ${endDate ? 'AND r.received_date <= ?' : ''}
          GROUP BY s.id, s.name, DATE(r.received_date)
          UNION ALL
          SELECT s.id AS supplier_id, s.name AS supplier_name, DATE_FORMAT(r.received_date, '%Y-%m') AS period, 'monthly' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
          FROM inv_purchase_order_receipts r
          JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
          JOIN inv_purchase_orders po ON r.order_id = po.id
          JOIN inv_suppliers s ON po.supplier_id = s.id
          WHERE poi.inventory_item_id = ? ${supplierId ? 'AND s.id = ?' : ''} ${startDate ? 'AND r.received_date >= ?' : ''} ${endDate ? 'AND r.received_date <= ?' : ''}
          GROUP BY s.id, s.name, DATE_FORMAT(r.received_date, '%Y-%m')
          UNION ALL
          SELECT s.id AS supplier_id, s.name AS supplier_name, CONCAT(YEAR(r.received_date)) AS period, 'yearly' AS period_type, SUM(r.quantity_received) AS quantity, SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)) AS amount
          FROM inv_purchase_order_receipts r
          JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
          JOIN inv_purchase_orders po ON r.order_id = po.id
          JOIN inv_suppliers s ON po.supplier_id = s.id
          WHERE poi.inventory_item_id = ? ${supplierId ? 'AND s.id = ?' : ''} ${startDate ? 'AND r.received_date >= ?' : ''} ${endDate ? 'AND r.received_date <= ?' : ''}
          GROUP BY s.id, s.name, CONCAT(YEAR(r.received_date))
  ORDER BY supplier_name, period`, [
      itemId, ...(supplierId ? [supplierId] : []), ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(supplierId ? [supplierId] : []), ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(supplierId ? [supplierId] : []), ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getSupplierPerformanceMetrics(itemId: string, startDate?: string, endDate?: string): Promise<SupplierPerformanceMetrics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
            SELECT
                s.id AS supplier_id,
                s.name AS supplier_name,
                COUNT(*) AS total_deliveries,
                SUM(r.quantity_received) AS total_quantity_received,
                ROUND(SUM(r.quantity_received * COALESCE(r.unit_price, poi.unit_price, 0)), 2) AS total_amount,

                ROUND(AVG(DATEDIFF(r.received_date, po.order_date)), 2) AS avg_lead_time_days,
                MIN(DATEDIFF(r.received_date, po.order_date)) AS min_lead_time_days,
                MAX(DATEDIFF(r.received_date, po.order_date)) AS max_lead_time_days,

                ROUND(
                    (SUM(CASE WHEN r.received_date <= COALESCE(po.expected_delivery_date, r.received_date) THEN 1 ELSE 0 END) / COUNT(*)) * 100,
                    2
                ) AS on_time_delivery_rate_percent,

                ROUND(
                    (SUM(CASE WHEN r.quality_check_passed = 0 OR r.condition_status NOT IN ('good', 'acceptable') THEN r.quantity_received ELSE 0 END)
                     / NULLIF(SUM(r.quantity_received), 0)) * 100,
                    2
                ) AS rejection_rate_percent,

                SUM(CASE WHEN r.quality_check_passed = 0 THEN 1 ELSE 0 END) AS failed_qc_count,

                ROUND(STDDEV(r.unit_price), 4) AS price_stability_stddev,

                ROUND(
                    (SUM(r.quantity_received) / NULLIF(total.total_received, 0)) * 100,
                    2
                ) AS dependency_risk_percent,

                CASE WHEN total_suppliers.total_suppliers_count = 1 THEN 1 ELSE 0 END AS is_single_source

            FROM inv_purchase_order_receipts r
            JOIN inv_purchase_order_items poi ON r.order_item_id = poi.id
            JOIN inv_purchase_orders po ON r.order_id = po.id
            JOIN inv_suppliers s ON po.supplier_id = s.id
            CROSS JOIN (
                SELECT SUM(r2.quantity_received) AS total_received
                FROM inv_purchase_order_receipts r2
                JOIN inv_purchase_order_items poi2 ON r2.order_item_id = poi2.id
                WHERE poi2.inventory_item_id = ?
                  ${startDate ? 'AND r2.received_date >= ?' : ''}
                  ${endDate ? 'AND r2.received_date <= ?' : ''}
            ) total
            CROSS JOIN (
                SELECT COUNT(DISTINCT po2.supplier_id) AS total_suppliers_count
                FROM inv_purchase_orders po2
                JOIN inv_purchase_order_items poi2 ON po2.id = poi2.order_id
                JOIN inv_purchase_order_receipts r2 ON r2.order_item_id = poi2.id
                WHERE poi2.inventory_item_id = ?
                  ${startDate ? 'AND r2.received_date >= ?' : ''}
                  ${endDate ? 'AND r2.received_date <= ?' : ''}
            ) total_suppliers
            WHERE poi.inventory_item_id = ?
              ${startDate ? 'AND r.received_date >= ?' : ''}
              ${endDate ? 'AND r.received_date <= ?' : ''}
            GROUP BY s.id, s.name, total.total_received, total_suppliers.total_suppliers_count
            ORDER BY dependency_risk_percent DESC
        `, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getTestConsumptionAnalytics(itemId: string, startDate?: string, endDate?: string): Promise<TestConsumptionAnalytics[]> {
    const connection = await this.getConnection();

    const results = await connection.raw(`
    SELECT DATE(ta.ascension_date) AS period, 'daily' AS period_type, ta.testid AS test_id, COALESCE(tp.name, CONCAT('Unknown Test (ID: ', ta.testid, ')')) AS test_name, COUNT(ta.id) AS completed_tests_count, SUM(iti.quantity) AS expected_consumption_quantity, COALESCE(SUM(txn.quantity), 0) AS actual_consumption_quantity_linked, SUM(iti.quantity) - COALESCE(SUM(txn.quantity), 0) AS variance_quantity, ROUND(CASE WHEN SUM(iti.quantity) > 0 THEN 100.0 * COALESCE(SUM(txn.quantity), 0) / SUM(iti.quantity) ELSE 0 END, 2) AS actual_vs_expected_percent
    FROM inv_inventory_template_items iti
    JOIN inv_inventory_templates itpl ON iti.template_id = itpl.id
    JOIN test_ascension ta ON ta.testid = CAST(itpl.testId AS UNSIGNED) AND ta.resultEntryEnd IS NOT NULL
    JOIN dboservices ds ON ds.trackId = ta.testid AND ds.billingid = ta.billingid AND ds.categoryTrackId != 6
    LEFT JOIN test_panels tp ON tp.id = ta.testid
  LEFT JOIN inv_inventory_transactions txn ON txn.ascensionid = ta.id AND txn.item_id = iti.itemId AND txn.transaction_type = 'consumption'
  WHERE iti.itemId = ? ${startDate ? 'AND ta.ascension_date >= ?' : ''} ${endDate ? 'AND ta.ascension_date <= ?' : ''}
      GROUP BY DATE(ta.ascension_date), ta.testid, tp.name
    UNION ALL
    SELECT DATE_FORMAT(ta.ascension_date, '%Y-%m') AS period, 'monthly' AS period_type, ta.testid AS test_id, COALESCE(tp.name, CONCAT('Unknown Test (ID: ', ta.testid, ')')) AS test_name, COUNT(ta.id) AS completed_tests_count, SUM(iti.quantity) AS expected_consumption_quantity, COALESCE(SUM(txn.quantity), 0) AS actual_consumption_quantity_linked, SUM(iti.quantity) - COALESCE(SUM(txn.quantity), 0) AS variance_quantity, ROUND(CASE WHEN SUM(iti.quantity) > 0 THEN 100.0 * COALESCE(SUM(txn.quantity), 0) / SUM(iti.quantity) ELSE 0 END, 2) AS actual_vs_expected_percent
    FROM inv_inventory_template_items iti
    JOIN inv_inventory_templates itpl ON iti.template_id = itpl.id
    JOIN test_ascension ta ON ta.testid = CAST(itpl.testId AS UNSIGNED) AND ta.resultEntryEnd IS NOT NULL
    JOIN dboservices ds ON ds.trackId = ta.testid AND ds.billingid = ta.billingid AND ds.categoryTrackId != 6
    LEFT JOIN test_panels tp ON tp.id = ta.testid
    LEFT JOIN inv_inventory_transactions txn ON txn.ascensionid = ta.id AND txn.item_id = iti.itemId AND txn.transaction_type = 'consumption'
    WHERE iti.itemId = ? ${startDate ? 'AND ta.ascension_date >= ?' : ''} ${endDate ? 'AND ta.ascension_date <= ?' : ''}
    GROUP BY DATE_FORMAT(ta.ascension_date, '%Y-%m'), ta.testid, tp.name
    UNION ALL
    SELECT CONCAT(YEAR(ta.ascension_date)) AS period, 'yearly' AS period_type, ta.testid AS test_id, COALESCE(tp.name, CONCAT('Unknown Test (ID: ', ta.testid, ')')) AS test_name, COUNT(ta.id) AS completed_tests_count, SUM(iti.quantity) AS expected_consumption_quantity, COALESCE(SUM(txn.quantity), 0) AS actual_consumption_quantity_linked, SUM(iti.quantity) - COALESCE(SUM(txn.quantity), 0) AS variance_quantity, ROUND(CASE WHEN SUM(iti.quantity) > 0 THEN 100.0 * COALESCE(SUM(txn.quantity), 0) / SUM(iti.quantity) ELSE 0 END, 2) AS actual_vs_expected_percent
    FROM inv_inventory_template_items iti
    JOIN inv_inventory_templates itpl ON iti.template_id = itpl.id
    JOIN test_ascension ta ON ta.testid = CAST(itpl.testId AS UNSIGNED) AND ta.resultEntryEnd IS NOT NULL
    JOIN dboservices ds ON ds.trackId = ta.testid AND ds.billingid = ta.billingid AND ds.categoryTrackId != 6
    LEFT JOIN test_panels tp ON tp.id = ta.testid
    LEFT JOIN inv_inventory_transactions txn ON txn.ascensionid = ta.id AND txn.item_id = iti.itemId AND txn.transaction_type = 'consumption'
    WHERE iti.itemId = ? ${startDate ? 'AND ta.ascension_date >= ?' : ''} ${endDate ? 'AND ta.ascension_date <= ?' : ''}
    GROUP BY CONCAT(YEAR(ta.ascension_date)), ta.testid, tp.name
    ORDER BY period DESC, expected_consumption_quantity DESC`, [
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []),
      itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])
    ].filter(Boolean));

    return results[0] || [];
  }

  async getAverageConsumption(itemId: string, startDate?: string, endDate?: string): Promise<AverageConsumption> {
    const connection = await this.getConnection();

    const result = await connection.raw(`
            SELECT
                COALESCE(AVG(daily_quantity), 0) AS average_daily_consumption_quantity,
                COALESCE(AVG(daily_amount), 0) AS average_daily_consumption_amount
            FROM (
                SELECT
                    DATE(t.transaction_date) AS day,
                    SUM(t.quantity) AS daily_quantity,
                    SUM(COALESCE(t.total_cost, 0)) AS daily_amount
                FROM inv_inventory_transactions t
                WHERE t.item_id = ?
                  AND t.transaction_type = 'consumption'
                  ${startDate ? 'AND t.transaction_date >= ?' : ''}
                  ${endDate ? 'AND t.transaction_date <= ?' : ''}
                GROUP BY DATE(t.transaction_date)
            ) AS daily_consumption
        `, [itemId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])].filter(Boolean));

    return result[0][0] || {
      average_daily_consumption_quantity: 0,
      average_daily_consumption_amount: 0
    };
  }
}