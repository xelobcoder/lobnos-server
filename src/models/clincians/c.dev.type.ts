export interface BillingStrategyRequestBody {
  allconcessionApplied: boolean;
  concessionValue: number;
  concessionMode: 'absolute' | 'percentage';
  price_type?: 'discount' | 'surcharge';
  valid_from?: string;
  valid_until?: string;
  name: string;
  description?: string;
  applicableTest?: { testid: number; concessionValue: number; discountedValue: number; concessionMode: 'absolute' | 'percentage'; pricingType: 'discount' | 'surcharge'; actualPrice: number; originalPrice: number }[];
}

export interface IBillingStrategy {
  strategyid: number;
  name: string;
  description: string | null;
  allconcessionApplied: number;
  concessionValue: number;
  concessionMode: 'absolute' | 'percentage';
  price_type: 'discount' | 'surcharge';
  valid_from: string | null;
  valid_until: string | null;
  is_expired: boolean;
  createdon: string;
  updatedon: string | null;
}

export type EntityType = 'clinician' | 'insurance' | 'organization' | 'general' | 'phis'

export interface ApplicableEntity {
  entity_type: EntityType;
  entity_id: number;
}

export interface ApplicableTest {
  testid: number;
  concessionValue: number;
  discountedValue: number;
  concessionMode: 'absolute' | 'percentage';
  pricingType: 'discount' | 'surcharge';
  actualPrice: number;
  originalPrice: number;
}