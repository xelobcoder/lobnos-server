import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsOptional } from "class-validator";

export class EmployeesRoleAssignmentDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     roleId?: number;

     @IsOptional()
     @IsDateString()
     assignedAt?: string | Date | null;
}
