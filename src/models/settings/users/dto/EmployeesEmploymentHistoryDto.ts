import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesEmploymentHistoryDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     historyId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsString()
     organization?: string | null;

     @IsOptional()
     @IsString()
     position?: string | null;

     @IsOptional()
     @IsDateString()
     startDate?: string | Date | null;

     @IsOptional()
     @IsDateString()
     endDate?: string | Date | null;

     @IsOptional()
     @IsString()
     responsibilities?: string | null;
}
