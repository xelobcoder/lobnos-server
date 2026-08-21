import { ICommissionTier } from '../interfaces/CommissionTier.interface';

export interface ICommissionTierRepository {
     findById(id: number): Promise<ICommissionTier | null>;
     findByConfigId(configId: number): Promise<ICommissionTier[]>;
     findMatchingTier(configId: number, amount: number): Promise<ICommissionTier | null>;
     create(tier: Omit<ICommissionTier, 'id' | 'created_at'>): Promise<ICommissionTier>;
     createMultiple(tiers: Omit<ICommissionTier, 'id' | 'created_at'>[], commission_config_id: number): Promise<ICommissionTier[]>;
     delete(id: number): Promise<void>;
     deleteByConfigId(configId: number): Promise<void>;
}
