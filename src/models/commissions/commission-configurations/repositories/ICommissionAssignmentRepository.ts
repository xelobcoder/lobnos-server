import { ICommissionAssignment } from '../interfaces/CommissionAssignment.interface';

export interface ICommissionAssignmentRepository {
     findById(id: number): Promise<ICommissionAssignment | null>;
     findByConfigId(configId: number): Promise<ICommissionAssignment[]>;
     findActive(onDate: Date): Promise<ICommissionAssignment[]>;
     findApplicable(params: {
          date: Date;
          scopeType: string;
          scopeId?: number;
     }): Promise<ICommissionAssignment[]>;
     create(
          assignment: Omit<ICommissionAssignment, 'id' | 'created_at'>
     ): Promise<ICommissionAssignment>;
     softDelete(id: number): Promise<void>;
     getByIdOrThrow(id: number): Promise<ICommissionAssignment>;
}
