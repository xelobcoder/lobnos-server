import { Transform } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class EmployeesPerformanceReviewDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     reviewId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     employeeId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsInt()
     reviewerId?: number | null;

     @IsOptional()
     @IsDateString()
     reviewPeriodStart?: string | Date | null;

     @IsOptional()
     @IsDateString()
     reviewPeriodEnd?: string | Date | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsNumber()
     punctualityScore?: number | string | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsNumber()
     teamworkScore?: number | string | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsNumber()
     productivityScore?: number | string | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsNumber()
     communicationScore?: number | string | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsNumber()
     professionalismScore?: number | string | null;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === null || value === undefined ? null : Number(value))
     @IsNumber()
     overallScore?: number | string | null;

     @IsOptional()
     @IsString()
     strengths?: string | null;

     @IsOptional()
     @IsString()
     weaknesses?: string | null;

     @IsOptional()
     @IsString()
     recommendations?: string | null;

     @IsOptional()
     @IsString()
     reviewComments?: string | null;

     @IsOptional()
     @IsDateString()
     reviewDate?: string | Date | null;

     @IsOptional()
     @IsDateString()
     createdAt?: string | Date | null;
}
