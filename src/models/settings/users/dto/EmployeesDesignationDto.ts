import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesDesignationDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     designationId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsInt()
     departmentId?: number | null;

     @IsOptional()
     @IsString()
     designationName?: string;

     @IsOptional()
     @IsString()
     description?: string | null;

     @IsOptional()
     @IsDateString()
     createdAt?: string | Date | null;
}
