# Inventory Analytics API Payload Interface

## ProcurementAnalytics Interface

```typescript
export interface ProcurementAnalytics {
     supplier_performance: Array<{
          supplier_id: string;
          supplier_name: string;
          lead_time_days: number;
          on_time_delivery_rate: number;
          delivery_discrepancy_rate: number;
          defect_rate: number;
          reliability_score: number;
          total_orders: number;
          total_order_value: number;
     }>;
     pricing_analytics: {
          price_history: Array<{
               item_id: string;
               item_name: string;
               supplier_id: string;
               supplier_name: string;
               purchase_date: string;
               unit_price: number;
               trend: 'increasing' | 'decreasing' | 'stable';
          }>;
          average_cost_per_supplier: Array<{
               supplier_id: string;
               supplier_name: string;
               average_unit_cost: number;
               last_purchase_price: number;
               standard_cost_variance: number;
          }>;
          best_suppliers: Array<{
               supplier_id: string;
               supplier_name: string;
               cost_score: number;
               quality_score: number;
               overall_score: number;
               ranking: number;
          }>;
     };
     procurement_efficiency: {
          average_po_processing_time_days: number;
          average_payment_cycle_days: number;
          emergency_purchases_count: number;
          emergency_purchase_percentage: number;
          order_accuracy_rate: number;
          supplier_response_time_avg: number;
     };
     order_patterns: {
          seasonal_trends: Array<{
               month: string;
               order_count: number;
               total_value: number;
               avg_order_value: number;
               growth_percentage: number;
          }>;
          order_frequency_analysis: {
               average_orders_per_supplier: number;
               average_orders_per_month: number;
               bulk_order_percentage: number;
               rush_order_percentage: number;
          };
          demand_patterns: Array<{
               item_id: string;
               item_name: string;
               reorder_frequency_days: number;
               average_order_quantity: number;
               demand_volatility: number;
               forecast_accuracy: number;
          }>;
     };
     cost_analysis: {
          budget_vs_actual: {
               total_budget: number;
               total_spent: number;
               budget_utilization_percentage: number;
               variance_amount: number;
               variance_percentage: number;
          };
          cost_savings_opportunities: Array<{
               category: string;
               potential_savings: number;
               description: string;
               priority: 'high' | 'medium' | 'low';
          }>;
          procurement_cost_trends: Array<{
               month: string;
               total_cost: number;
               cost_per_unit: number;
               cost_variance_percentage: number;
          }>;
     };
     supplier_risk_analysis: {
          supplier_concentration: Array<{
               supplier_id: string;
               supplier_name: string;
               percentage_of_total_spend: number;
               risk_level: 'low' | 'medium' | 'high' | 'critical';
               alternative_suppliers_count: number;
          }>;
          supplier_performance_trends: Array<{
               supplier_id: string;
               supplier_name: string;
               period: string;
               on_time_delivery_rate: number;
               quality_score: number;
               trend: 'improving' | 'declining' | 'stable';
          }>;
          supply_chain_risks: Array<{
               risk_type: string;
               affected_suppliers: number;
               potential_impact: 'low' | 'medium' | 'high';
               mitigation_strategy: string;
          }>;
     };
     quality_compliance: {
          quality_metrics: {
               overall_defect_rate: number;
               supplier_quality_scores: Array<{
                    supplier_id: string;
                    supplier_name: string;
                    quality_score: number;
                    defect_rate: number;
                    return_rate: number;
               }>;
               quality_trends: Array<{
                    month: string;
                    defect_rate: number;
                    return_rate: number;
                    quality_score: number;
               }>;
          };
          compliance_metrics: {
               contract_compliance_rate: number;
               on_time_payment_rate: number;
               documentation_completeness: number;
               regulatory_compliance_score: number;
          };
     };
}
```

## API Endpoints

### GET /api/analytics/procurement
Retrieves comprehensive procurement analytics including supplier performance, pricing analysis, procurement efficiency, order patterns, cost analysis, supplier risk assessment, and quality compliance metrics.

**Response Format:**
```json
{
  "success": true,
  "message": "Procurement analytics retrieved successfully",
  "data": {
    "supplier_performance": [...],
    "pricing_analytics": {...},
    "procurement_efficiency": {...},
    "order_patterns": {...},
    "cost_analysis": {...},
    "supplier_risk_analysis": {...},
    "quality_compliance": {...}
  }
}
```

## Analytics Categories

### 1. Supplier Performance
- Lead time analysis
- On-time delivery rates
- Delivery discrepancy tracking
- Defect rate monitoring
- Reliability scoring
- Order volume and value metrics

### 2. Pricing Analytics
- Historical price tracking (placeholder for future implementation)
- Supplier cost comparisons (placeholder for future implementation)
- Best supplier rankings (placeholder for future implementation)

### 3. Procurement Efficiency
- PO processing time analysis
- Payment cycle monitoring
- Emergency purchase tracking
- Order accuracy metrics
- Supplier response time analysis

### 4. Order Patterns
- Seasonal trend analysis
- Order frequency metrics
- Bulk vs individual order analysis
- Demand pattern forecasting
- Reorder frequency analysis

### 5. Cost Analysis
- Budget vs actual spending (requires budget data)
- Cost savings opportunity identification
- Procurement cost trend analysis
- Cost variance monitoring

### 6. Supplier Risk Analysis
- Supplier concentration assessment
- Performance trend monitoring
- Supply chain risk identification
- Risk mitigation strategies

### 7. Quality & Compliance
- Overall defect rate tracking
- Supplier quality scoring
- Contract compliance monitoring
- Regulatory compliance assessment
- Documentation completeness tracking

## Implementation Notes

- All analytics are calculated based on the last 12 months of data
- Some sections contain placeholder data that would require additional database tables or fields
- Risk levels are calculated based on percentage of total spend thresholds
- Seasonal trends include month-over-month growth calculations
- Quality scores are simplified calculations based on delivery accuracy