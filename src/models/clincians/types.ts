import { Request, Response } from "express";

export interface IClinicianOperations {
     getClinicians(): Promise<void>;
     putCliniciansBasic(req: Request, res: Response): Promise<void>;
     deleteClinicians(req: Request, res: Response): Promise<void>;
     postClinicianBasicInfo(req: Request, res: Response): Promise<string | number>;
     getSingleClinician(req: Request, res: Response): void;
     getTopPerformingClinicians(req: Request, res: Response): void;
     getClinicianResult(clinicianid: number, startdate?: string, enddate?: string): Promise<any[]>;
     getBillingTestBasedByClinician(billingid: number, clinicianid: number): Promise<any[]>;
}


export type Clinician = {
     id?: number;
     name: string;
     email: string;
     location: string;
     address: string;
     occupation: string;
     organization: number;
     updated_on?: string | null;
     created_on?: string;
};

