export interface UpdateCredentialsRequest {
  opassword: string;
  npassword: string;
  nppassword: string;
  patientid: number;
  isAdmin?: boolean;
  employeeid?: number;
  providedUsername?: string;
}