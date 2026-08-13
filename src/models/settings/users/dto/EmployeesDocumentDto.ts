import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";

export type EmployeeDocumentTypeDto =
     | 'cv'
     | 'certificate'
     | 'license'
     | 'passport'
     | 'national_id'
     | 'appointment_letter'
     | 'other';

export class EmployeesDocumentDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     documentId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsEnum(['cv', 'certificate', 'license', 'passport', 'national_id', 'appointment_letter', 'other'])
     documentType?: EmployeeDocumentTypeDto | null;

     @IsOptional()
     @IsString()
     fileName?: string | null;

     @IsOptional()
     @IsString()
     filePath?: string | null;

     @IsOptional()
     @IsDateString()
     uploadedAt?: string | Date | null;
}
