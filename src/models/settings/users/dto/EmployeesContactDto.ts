import { Transform } from "class-transformer";
import { IsDateString, IsEmail, IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesContactDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     contactId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsEmail()
     email?: string | null;

     @IsOptional()
     @IsString()
     mobile?: string | null;

     @IsOptional()
     @IsString()
     alternativeMobile?: string | null;

     @IsOptional()
     @IsString()
     address?: string | null;

     @IsOptional()
     @IsString()
     city?: string | null;

     @IsOptional()
     @IsString()
     state?: string | null;

     @IsOptional()
     @IsString()
     country?: string | null;

     @IsOptional()
     @IsString()
     postalCode?: string | null;

     @IsOptional()
     @IsDateString()
     createdAt?: string | Date | null;
}
