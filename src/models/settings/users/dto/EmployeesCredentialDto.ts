import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesCredentialDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     credentialId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsString()
     username?: string;

     @IsOptional()
     @IsString()
     passwordHash?: string;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsInt()
     pin?: number | null;

     @IsOptional()
     @IsString()
     refreshToken?: string | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : value)
     @IsBoolean()
     emailVerified?: boolean | number | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : value)
     @IsBoolean()
     accountActivated?: boolean | number | null;

     @IsOptional()
     @IsDateString()
     lastLogin?: string | Date | null;

     @IsOptional()
     @IsDateString()
     createdAt?: string | Date | null;
}
