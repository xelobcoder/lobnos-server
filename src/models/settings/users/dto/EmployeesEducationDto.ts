import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class EmployeesEducationDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     educationId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @IsString()
     institution?: string;

     @IsOptional()
     @IsString()
     degree?: string | null;

     @IsOptional()
     @IsString()
     fieldOfStudy?: string | null;

     @IsOptional()
     @IsDateString()
     startDate?: string | Date | null;

     @IsOptional()
     @IsDateString()
     endDate?: string | Date | null;

     @IsOptional()
     @IsString()
     grade?: string | null;

     @IsOptional()
     @IsString()
     certificateNumber?: string | null;
}
