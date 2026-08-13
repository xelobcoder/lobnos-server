import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesBankAccountDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     bankAccountId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsString()
     bankName?: string | null;

     @IsOptional()
     @IsString()
     accountName?: string | null;

     @IsOptional()
     @IsString()
     accountNumber?: string | null;

     @IsOptional()
     @IsString()
     branchName?: string | null;

     @IsOptional()
     @IsString()
     mobileMoneyNumber?: string | null;
}
