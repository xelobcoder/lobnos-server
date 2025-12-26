export interface InventoryAnalyticsSummary {
     total_items: number;
     active_items: number;
     low_stock_items: number;
     out_of_stock_items: number;
     total_stock_value: number;
     total_categories: number;
     total_suppliers: number;
     total_locations: number;
}



export interface PurchaseOrderAnalytics {
     total_orders: number;
     pending_orders: number;
     partially_received_orders: number;
     received_orders: number;
     cancelled_orders: number;
     orders_by_month: Array<{
          month: string;
          count: number;
          value: number;
     }>;
     top_suppliers: Array<{
          supplier_id: string;
          supplier_name: string;
          order_count: number;
          total_value: number;
     }>;
}

export interface InventoryTurnoverAnalytics {
     average_turnover_ratio: number;
     turnover_by_category: Array<{
          category_id: string;
          category_name: string;
          turnover_ratio: number;
     }>;
     slow_moving_items: Array<{
          item_id: string;
          item_name: string;
          days_since_last_movement: number;
          current_stock: number;
     }>;
}

export interface SupplierAnalytics {
     supplier_info: {
          supplier_id: string;
          supplier_name: string;
          contact_info: {
               contact_person: string;
               email: string;
               phone: string;
               address: string;
          };
          status: string;
          relationship_timeline: {
               first_order_date: string;
               last_order_date: string;
               days_since_first_order: number;
               days_since_last_order: number;
               active_months: number;
          };
     } | null;
     performance_scorecard: {
          overall_performance: {
               performance_score: number;
               risk_category: string;
               strategic_importance: string;
          };
          volume_metrics: {
               total_orders: number;
               total_spend: number;
               avg_order_value: number;
               largest_order: number;
               smallest_order: number;
          };
          order_status_breakdown: {
               completed_orders: number;
               pending_orders: number;
               cancelled_orders: number;
               partially_received_orders: number;
               completion_rate: number;
               cancellation_rate: number;
          };
          operational_metrics: {
               unique_items_supplied: number;
               avg_lead_time: number;
               lead_time_consistency: number;
               avg_delivery_delay: number;
               quality_performance: number;
          };
     } | null;
     monthly_trends: Array<{
          period: string;
          year: number;
          month: number;
          metrics: {
               monthly_orders: number;
               monthly_spend: number;
               avg_monthly_order_value: number;
               monthly_received_value: number;
               monthly_cancelled_value: number;
               three_month_avg_spend: number;
          };
          order_status: {
               completed_orders: number;
               pending_orders: number;
               cancelled_orders: number;
          };
     }>;
     delivery_performance: {
          summary: {
               total_deliveries: number;
               on_time_deliveries: number;
               late_deliveries: number;
               on_time_rate: number;
               reliability_rating: string;
          };
          lead_time_analysis: {
               avg_actual_lead_time: number;
               avg_promised_lead_time: number;
               avg_lead_time_variance: number;
               lead_time_consistency: number;
               min_lead_time: number;
               max_lead_time: number;
          };
          delay_analysis: {
               avg_delay_days: number;
               max_delay_days: number;
               severe_delays: number;
          };
     } | null;
     quality_metrics: {
          quality_scores: {
               condition_quality_score: number;
               quality_check_score: number;
               overall_quality_rating: string;
          };
          condition_breakdown: {
               total_receipts: number;
               good_condition_count: number;
               acceptable_condition_count: number;
               poor_condition_count: number;
          };
          quality_check_results: {
               passed_quality_checks: number;
               failed_quality_checks: number;
          };
          shelf_life_analysis: {
               avg_shelf_life_on_arrival: number;
               expired_on_arrival: number;
               short_shelf_life_items: number;
          };
     } | null;
     product_portfolio: Array<{
          item_id: string;
          item_name: string;
          sku: string;
          category_name: string;
          order_metrics: {
               times_ordered: number;
               total_quantity_ordered: number;
               total_quantity_received: number;
               avg_fulfillment_rate: number;
          };
          pricing_metrics: {
               avg_unit_price: number;
               min_unit_price: number;
               max_unit_price: number;
               price_volatility: number;
               total_spend_on_item: number;
          };
          recent_activity: {
               last_ordered_date: string;
               days_since_last_order: number;
          };
     }>;
     recent_activity: {
          orders: Array<{
               order_id: string;
               order_number: string;
               order_date: string;
               expected_delivery_date: string;
               status: string;
               delivery_status: string;
               total_amount: number;
               line_item_count: number;
               quantity_metrics: {
                    total_ordered: number;
                    total_received: number;
                    pending: number;
               };
               timeline: {
                    days_since_order: number;
                    days_past_due: number;
               };
          }>;
          payments: Array<{
               payment_id: string;
               payment_reference: string;
               payment_amount: number;
               payment_date: string;
               payment_method: string;
               payment_status: string;
               reference_number: string;
               order_number: string;
               order_total: number;
               approval_info: {
                    approved_by: string;
                    approved_at: string;
                    processed_at: string;
               };
          }>;
     };
     key_terms_explanation: {
          performance_score: string;
          risk_category: string;
          strategic_importance: string;
          lead_time: string;
          on_time_delivery_rate: string;
          quality_performance: string;
          fulfillment_rate: string;
          price_volatility: string;
          shelf_life_analysis: string;
          delivery_reliability_rating: string;
          order_completion_rate: string;
          supplier_relationship_timeline: string;
          product_portfolio_diversity: string;
          payment_terms_analysis: string;
     };
}

export interface TransactionAnalytics {
     // EXECUTIVE SUMMARY - Key metrics business managers need to see first
     executive_summary: {
          total_inventory_value: number;
          monthly_transaction_volume: number;
          inventory_turnover_ratio: number;
          stockout_risk_level: string;
          supplier_performance_score: number;
          cost_efficiency_rating: string;
     };

     // FINANCIAL IMPACT - Cost analysis and profitability insights
     financial_impact: {
          total_transaction_value: number;
          average_transaction_value: number;
          cost_savings_opportunities: number;
          budget_impact_alerts: string;
          profitability_indicators: {
               high_value_transactions: number;
               cost_per_unit_trend: number;
               volume_vs_cost_efficiency: number;
          };
     };

     // OPERATIONAL EFFICIENCY - How well the inventory system is performing
     operational_efficiency: {
          transaction_processing_speed: number;
          inventory_accuracy_score: number;
          process_bottlenecks: string;
          automation_opportunities: number;
          efficiency_trends: {
               transaction_volume_trend: string;
               error_rate: number;
               processing_time_efficiency: string;
          };
     };

     // RISK MANAGEMENT - Critical alerts and risk indicators
     risk_management: {
          critical_alerts: string[];
          stockout_prevention_score: number;
          supplier_reliability_score: number;
          compliance_risks: number;
          financial_risks: string;
          operational_risks: string;
     };

     // BUSINESS INSIGHTS - Actionable recommendations
     business_insights: {
          top_opportunities: string[];
          immediate_actions_needed: string[];
          strategic_recommendations: string[];
          cost_optimization_targets: Array<{
               reason: string;
               potential_savings: number;
               priority: string;
          }>;
     };

     // SIMPLIFIED METRICS - Easy to understand key indicators
     key_performance_indicators: {
          transactions_per_day: number;
          inventory_turnover_days: number;
          supplier_performance_rating: string;
          process_efficiency_score: number;
          cost_effectiveness_rating: string;
     };

     // DETAILED ANALYTICS - For deep dive when needed
     detailed_analytics: {
          core_metrics: {
               transaction_volume: {
                    total_transactions: number;
                    total_quantity_moved: number;
                    avg_quantity_per_transaction: number;
                    total_transaction_value: number;
               };
               transaction_type_distribution: {
                    consumption: number;
                    addition: number;
                    wastage: number;
                    adjustment: number;
                    transfer: number;
               };
               cost_analysis: {
                    addition_cost: number;
                    avg_addition_unit_cost: number;
               };
          } | null;
          time_pattern_analysis: {
               daily_patterns: Array<{
                    date: string;
                    transaction_count: number;
                    total_quantity: number;
               }>;
               peak_hours: Array<{
                    hour: number;
                    transaction_count: number;
               }>;
          };
          high_volume_transactions: Array<{
               date: string;
               transaction_count: number;
               total_quantity: number;
               total_cost: number;
               unique_items_affected: number;
               volume_category: string;
               cost_category: string;
               transaction_breakdown: {
                    wastage: number;
                    consumption: number;
                    addition: number;
                    adjustment: number;
               };
               quantity_breakdown: {
                    wastage_quantity: number;
                    consumption_quantity: number;
                    addition_quantity: number;
               };
               notable_wastage: string[];
          }>;
     };
}

export interface CostAnalytics {
     total_inventory_value: number;
     average_item_cost: number;
     cost_by_category: Array<{
          category_id: string;
          category_name: string;
          total_value: number;
          item_count: number;
     }>;
     monthly_cost_trends: Array<{
          month: string;
          additions_cost: number;
          consumption_cost: number;
     }>;
}

export interface PaymentAnalytics {
     total_payments: number;
     pending_payments: number;
     completed_payments: number;
     failed_payments: number;
     total_payment_value: number;
     average_payment_value: number;
     payments_by_method: Record<string, number>;
     supplier_payment_summary: Array<{
          supplier_id: string;
          supplier_name: string;
          total_paid: number;
          pending_amount: number;
          payment_count: number;
     }>;
}

export interface StockLevelAnalytics {
     current_stock_on_hand: number;
     stock_available_for_use: number;
     stock_on_order: number;
     allocated_stock: number;
     stock_threshold_alerts: Array<{
          item_id: string;
          item_name: string;
          current_stock: number;
          min_stock: number;
          max_stock: number;
          status: string;
          alert_type: 'low_stock' | 'over_stock' | 'out_of_stock';
     }>;
     days_of_inventory_remaining: Array<{
          item_id: string;
          item_name: string;
          current_stock: number;
          daily_consumption_rate: number;
          days_remaining: number;
          status: 'critical' | 'warning' | 'normal';
     }>;
     key_terms_explanation: {
          safety_stock: string;
          reorder_point: string;
          economic_order_quantity: string;
          service_level: string;
          demand_forecasting: string;
          trend_direction: string;
          forecast_confidence: string;
          stock_out_prediction: string;
          overstock_prediction: string;
          data_quality_alerts: string;
          anomaly_types: string;
          carrying_cost: string;
          lead_time: string;
          turnover_ratio: string;
     };
     predictive_analytics: {
          stock_out_predictions: Array<{
               item_id: string;
               item_name: string;
               predicted_stock_out_date: string;
               days_until_stock_out: number;
          }>;
          overstock_predictions: Array<{
               item_id: string;
               item_name: string;
               excess_quantity: number;
               carrying_cost_impact: number;
          }>;
          safety_stock_recommendations: Array<{
               item_id: string;
               item_name: string;
               current_safety_stock: number;
               recommended_safety_stock: number;
               reasoning: string;
               interpretation: string;
          }>;
          demand_forecasting: Array<{
               item_id: string;
               item_name: string;
               avg_monthly_demand: number;
               demand_trend: number;
               trend_direction: 'strong_increasing' | 'moderate_increasing' | 'stable' | 'moderate_decreasing' | 'strong_decreasing';
               next_month_forecast: number;
               month_2_forecast: number;
               month_3_forecast: number;
               forecast_confidence: 'high' | 'medium' | 'low';
               months_of_stock_cover: number;
               interpretation: string;
          }>;
          reorder_point_optimization: Array<{
               item_id: string;
               item_name: string;
               optimized_reorder_point: number;
               economic_order_quantity: number;
               target_service_level: number;
               stock_status: 'critical' | 'reorder_needed' | 'monitor' | 'adequate';
               interpretation: string;
          }>;
          data_quality_alerts: Array<{
               item_id: string;
               item_name: string;
               anomaly_type: string;
               description: string;
               recommended_action: string;
               severity: 'critical' | 'high' | 'medium' | 'low';
               interpretation: string;
          }>;
     };
}

export interface InventoryMovementAnalytics {
     movement_by_type: {
          total_received: number;
          total_issued: number;
          total_returned: number;
          internal_transfers_in: number;
          internal_transfers_out: number;
          write_offs: number;
          expired_quantity: number;
          wastage_quantity: number;
     };
     velocity_metrics: {
          item_turnover_rate: Array<{
               item_id: string;
               item_name: string;
               turnover_ratio: number;
               turnover_category: 'fast' | 'medium' | 'slow';
          }>;
          average_inventory_age: Array<{
               item_id: string;
               item_name: string;
               average_days_in_stock: number;
               last_movement_date: string;
          }>;
          fast_moving_items: Array<{
               item_id: string;
               item_name: string;
               monthly_movement: number;
               ranking: number;
          }>;
          slow_moving_items: Array<{
               item_id: string;
               item_name: string;
               days_since_last_movement: number;
               total_stock_value: number;
          }>;
     };
     movement_trends: Array<{
          month: string;
          received: number;
          issued: number;
          transfers: number;
          adjustments: number;
          net_movement: number;
     }>;
}

export interface BatchExpiryAnalytics {
     items_by_batch: Array<{
          batch_number: string;
          item_id: string;
          item_name: string;
          total_received: number;
          total_consumed: number;
          remaining_quantity: number;
          expiry_date: string;
          days_until_expiry: number;
          status: 'fresh' | 'near_expiry' | 'expired';
     }>;
     expiry_summary: {
          expired_stock_value: number;
          near_expiry_7_days: number;
          near_expiry_30_days: number;
          near_expiry_60_days: number;
          expired_items_count: number;
     };
     batch_expiry_distribution: Array<{
          expiry_range: string;
          batch_count: number;
          total_quantity: number;
     }>;
     items_with_multiple_batches: Array<{
          item_id: string;
          item_name: string;
          batch_count: number;
          total_quantity: number;
          earliest_expiry: string;
          latest_expiry: string;
     }>;
     batch_utilization: Array<{
          batch_number: string;
          expiry_date: string;
          original_quantity: number;
          item_id: string;
          item_name: string;
          consumed_quantity: number;
          remaining_quantity: number;
          utilization_percentage: number;
     }>;
}

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

export interface CostValuationAnalytics {
     cost_trends: Array<{
          month: string;
          additions_cost: number;
          consumption_cost: number;
          write_off_cost: number;
          net_cost_change: number;
     }>;
     profitability_impact: {
          cost_of_goods_issued: number;
          expired_stock_value: number;
          near_expiry_value: number;
          average_cost_per_unit: number;
     };
}

export interface UsageAnalytics {
     consumption_patterns: {
          consumption_trends: Array<{
               date: string;
               total_consumed: number;
               unique_items_used: number;
          }>;
          department_consumption: Array<{
               performed_by: string;
               username: string;
               role: string;
               total_consumed: number;
               unique_items_used: number;
               consumption_value: number;
               transaction_count: number;
          }>;
          category_consumption: Array<{
               category_name: string;
               total_consumed: number;
               unique_items_used: number;
               consumption_value: number;
               transaction_count: number;
          }>;
          predictive_usage: Array<{
               item_id: string;
               item_name: string;
               predicted_monthly_usage: number;
               confidence_level: number;
               based_on_history_months: number;
          }>;
     };
     anomalies_red_flags: {
          unusual_usage_spikes: Array<{
               item_id: string;
               item_name: string;
               date: string;
               actual_usage: number;
               expected_usage: number;
               deviation_percentage: number;
               potential_cause: string;
          }>;
          potential_theft_indicators: Array<{
               item_id: string;
               item_name: string;
               unusual_pattern: string;
               risk_level: 'low' | 'medium' | 'high';
               last_incident_date: string;
          }>;
          misallocation_trends: Array<{
               item_id: string;
               item_name: string;
               allocated_quantity: number;
               actual_usage: number;
               variance_percentage: number;
               performed_by: string;
               username: string;
               role: string;
          }>;
          fifo_compliance_issues: Array<{
               item_id: string;
               item_name: string;
               batch_number: string;
               expiry_date: string;
               consumption_date: string;
               days_early_consumption: number;
               risk_level: 'low' | 'medium' | 'high';
          }>;
          critical_alerts: Array<{
               alert_type: 'expiry_risk' | 'wastage_ratio' | 'overstocking';
               item_id: string;
               item_name: string;
               severity: 'low' | 'medium' | 'high' | 'critical';
               message: string;
               value: number;
               threshold: number;
          }>;
     };
     usage_efficiency: {
          stock_utilization_rate: number;
          wastage_rate: number;
          detailed_wastage_analysis: Array<{
               item_name: string;
               wastage_type: string;
               wastage_events: number;
               total_wasted_units: number;
               avg_wastage_per_event: number;
               wastage_percentage: number;
          }>;
          batch_utilization_analysis: Array<{
               item_name: string;
               batch_number: string;
               expiry_date: string;
               total_received: number;
               total_consumed: number;
               total_wasted: number;
               utilization_rate: number;
               days_to_expiry: number;
               utilization_status: 'excellent' | 'good' | 'poor' | 'critical' | 'expired';
          }>;
          stock_turnover_rates: Array<{
               item_name: string;
               total_added: number;
               total_consumed: number;
               total_wasted: number;
               consumption_rate: number;
               wastage_rate: number;
               turnover_efficiency: 'excellent' | 'good' | 'fair' | 'poor';
          }>;
          comprehensive_usage_summary: Array<{
               item_name: string;
               total_transactions: number;
               total_added: number;
               total_consumed: number;
               total_wasted: number;
               consumption_percentage: number;
               wastage_percentage: number;
               avg_daily_consumption: number;
               efficiency_score: number;
          }>;
          optimal_ordering_patterns: Array<{
               item_id: string;
               item_name: string;
               recommended_order_quantity: number;
               recommended_order_frequency_days: number;
               reasoning: string;
          }>;
     };
}