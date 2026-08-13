import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesLicenseDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     licenseId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsString()
     licenseName?: string | null;

     @IsOptional()
     @IsString()
     licenseNumber?: string | null;

     @IsOptional()
     @IsString()
     issuingAuthority?: string | null;

     @IsOptional()
     @IsDateString()
     issueDate?: string | Date | null;

     @IsOptional()
     @IsDateString()
     expiryDate?: string | Date | null;
}
