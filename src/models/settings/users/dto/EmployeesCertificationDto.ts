import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesCertificationDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     certificationId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsString()
     certificationName?: string | null;

     @IsOptional()
     @IsString()
     organization?: string | null;

     @IsOptional()
     @IsDateString()
     issueDate?: string | Date | null;

     @IsOptional()
     @IsDateString()
     expiryDate?: string | Date | null;
}
