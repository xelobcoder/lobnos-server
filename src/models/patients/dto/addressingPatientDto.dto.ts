import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, IsOptional, Min } from "class-validator";


export class PatientAddressingDto {
     @Transform(({ value }) => {
          if (typeof value === "string" && value.length > 0) {
               return Number(value);
          }
          return value;
     })
     @IsInt({ message: "patientid must be a valid number" })
     @IsNotEmpty()
     @Min(1)
     @IsInt()
     patientid!: number;

     @IsNotEmpty()
     @IsString()
     area?: string;

     @IsNotEmpty()
     @IsString()
     region?: string;

     @IsOptional()
     @IsString()
     gpsLocation?: string;


     @IsOptional()
     @IsString()
     country?: string;


     @IsOptional()
     @IsString()
     address?: string;

     @IsOptional()
     @IsString()
     district?: string;

}