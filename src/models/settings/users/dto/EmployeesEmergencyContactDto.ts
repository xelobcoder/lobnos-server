import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesEmergencyContactDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     emergencyContactId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsString()
     fullName?: string;

     @IsOptional()
     @IsString()
     relationship?: string | null;

     @IsOptional()
     @IsString()
     mobile?: string | null;

     @IsOptional()
     @IsString()
     address?: string | null;
}
