import { ICommissionConfig } from '../interfaces/CommissionConfig.interface';

export interface ICommissionConfigRepository {
     findById(id: number): Promise<ICommissionConfig | null>;
     findByName(name: string): Promise<ICommissionConfig | null>;
     findActive(onDate: Date): Promise<ICommissionConfig[]>;
     findAll(): Promise<ICommissionConfig[]>;
     create(config: Omit<ICommissionConfig, 'id' | 'created_at' | 'updated_at'>): Promise<ICommissionConfig>;
     softDelete(id: number): Promise<void>;
     getByIdOrThrow(id: number): Promise<ICommissionConfig>;
}
