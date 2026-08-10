
export type HL7MessageType = "ORU^R01";

export type ResultFlag =
     | "N" // Normal
     | "H" // High
     | "L" // Low
     | "HH" // Critical High
     | "LL" // Critical Low
     | "A" // Abnormal
     | "C"; // Critical

export type ResultStatus =
     | "F" // Final
     | "P" // Preliminary
     | "C" // Corrected
     | "X"; // Cancelled

export interface MedicalResult {
     Code: string;
     Name: string;
     Value: string;
     Unit: string;
     Reference: string;
     Flag: ResultFlag;
     Status: ResultStatus;
     TestedAt: string;
     Operator: string;
}

export interface BioLabInterfacingMessage {
     MessageType: HL7MessageType;
     MessageID: string;
     Version: string;

     PatientID: string;
     PatientName: string;

     SampleID: string;
     Specimen: string;

     CollectedAt: string;
     ReportedAt: string;

     Results: MedicalResult[];
}
