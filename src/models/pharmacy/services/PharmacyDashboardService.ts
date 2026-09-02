import { IPharmacyDashboardRepository, PharmacyDashboardData } from '../interfaces/IPharmacyDashboardRepository';
import { IPharmacyDashboardService } from '../interfaces/IPharmacyDashboardService';

export class PharmacyDashboardService implements IPharmacyDashboardService {
     constructor(private readonly dashboardRepository: IPharmacyDashboardRepository) { }

     async getDashboard(): Promise<PharmacyDashboardData> {
          return this.dashboardRepository.getDashboard();
     }
}