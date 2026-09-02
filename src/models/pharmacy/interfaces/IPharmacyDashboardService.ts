import { PharmacyDashboardData } from './IPharmacyDashboardRepository';

export interface IPharmacyDashboardService {
     /** Produces the pharmacy operational summary without exposing database concerns to routes. */
     getDashboard(): Promise<PharmacyDashboardData>;
}