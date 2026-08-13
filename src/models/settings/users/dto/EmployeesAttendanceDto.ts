import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsOptional } from "class-validator";

export class EmployeesAttendanceDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     attendanceId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsDateString()
     attendanceDate?: string | Date;

     @IsOptional()
     @IsDateString()
     checkIn?: string | Date | null;

     @IsOptional()
     @IsDateString()
     checkOut?: string | Date | null;
}
