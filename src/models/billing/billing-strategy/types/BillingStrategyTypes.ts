export type PriceType = 'percentage' | 'flat';
export type EntityType = 'organization' | 'insurance' | 'clinician' | 'general';
export type ConditionType = 'time_of_day' | 'day_of_week' | 'custom' | 'date_time_range';
export type Comparator = 'equals' | 'greater_than' | 'less_than';

export interface BillingStrategy {
  id?: number;
  name: string;
  description?: string;
  is_discount?: boolean;
  applies_to_all_tests?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface BillingStrategyAssignment {
  id?: number;
  billing_strategy_id: number;
  entity_type: EntityType;
  track_id?: number;
  applies_from: Date;
  applies_to?: Date;
}

export interface BillingStrategyPrice {
  id?: number;
  billing_strategy_id: number;
  test_panel_id?: number;
  price_type: PriceType;
  amount: number;
}

export interface BillingStrategyCondition {
  id?: number;
  billing_strategy_id: number;
  condition_type: ConditionType;
  condition_value?: string;
  comparator?: Comparator;
  start_datetime?: Date | null;
  end_datetime?: Date | null;
  start_time?: string;
  end_time?: string;
  timezone?: string;
}