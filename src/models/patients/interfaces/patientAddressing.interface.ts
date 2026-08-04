export interface IPatientAddressing {
     patientid: number;
     address: string;
     region: string;
     district: string;
     area: string;
     gpsLocation: string;
     country: string;
}



export interface ICreateEmergencyPatient {
     patientid: number;
     emmergencyContactName: string;
     emmergencyContactNumber: string;
     relationship: string;
     occupation: string;
     address: string;
}




export interface IPatientCredentials {
     patientid: number;
     username: string;
     password: string;
     updated_on: Date;
     updated: boolean;
}


