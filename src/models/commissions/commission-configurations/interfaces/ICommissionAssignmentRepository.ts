import { ICommissionAssignment } from '../interfaces/CommissionAssignment.interface';

export interface ICommissionAssignmentRepository {
     withTransaction?(trx: any): ICommissionAssignmentRepository;
     findById(id: number): Promise<ICommissionAssignment | null>;
     findByConfigId(configId: number, page?: number, count?: number): Promise<ICommissionAssignment[]>;
     findActive(params?: {
          onDate?: Date;
          page?: number;
          count?: number;
          filterType?: string;
          filterName?: string;
          status?: string;
     }): Promise<ICommissionAssignment[]>;
     findApplicable(params: {
          date: Date;
          scopeType: string;
          scopeId?: number;
     }): Promise<ICommissionAssignment[]>;
     create(
          assignment: Omit<ICommissionAssignment, 'id' | 'created_at'>
     ): Promise<ICommissionAssignment>;
     createMultiple(
          assignments: Omit<ICommissionAssignment, 'id' | 'created_at'>[]
     ): Promise<ICommissionAssignment[]>;
     softDelete(id: number): Promise<void>;
     getByIdOrThrow(id: number): Promise<ICommissionAssignment>;
}
