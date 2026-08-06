import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, min, Min } from "class-validator";

export class CheckMobileNumberDto {

     @IsNotEmpty()
     @Transform(({ value }) => {
          if (typeof value === "string" && value.length > 0) {
               return Number(value);
          }
          return value;
     })
     @IsInt({ message: "mobileno must be a valid number" })
     mobileno!: string;



     @Transform(({ value }) => {
          if (typeof value === "string" && value.length > 0) {
               return Number(value);
          }
          return value;
     })
     @IsInt({ message: "tenantId must be a valid number" })
     @Min(0)
     tenantId!: number;



     @IsOptional()
     @Transform(({ value }) => {
          if (typeof value === "string") {
               return Number(value);
          }
          return value;
     })
     @IsInt({ message: "patientid must be a valid number" })
     @Min(0)
     patientid?: number;


     @IsOptional()
     @Transform(({ value }) => {
          if (typeof value === "string") {
               return value === "true";
          }
          return value;
     })
     isGetData!: boolean;

}




export class CheckPatientIdDto {

     @Transform(({ value }) => {
          if (typeof value === "string" && value.length > 0) {
               return Number(value);
          }
          return value;
     })
     @IsInt({ message: "patientid must be a valid number" })
     @Min(1)
     patientid!: number

       @Transform(({ value }) => {
          if (typeof value === "string" && value.length > 0) {
               return Number(value);
          }
          return value;
     })
     @IsInt({ message: "tenantId must be a valid number" })
     @Min(0)
     tenantId!: number;

}