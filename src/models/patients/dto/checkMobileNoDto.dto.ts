import { normalizeSmsPhone } from '../../application/sms/SmsMessageMetrics';
import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, Matches, Min } from "class-validator";

export function normalizeRegistrationPhone(value: unknown) {
     const compact = String(value ?? '').replace(/[\s()+-]/g, '');
     return /^0\d{9}$/.test(compact) ? compact : normalizeSmsPhone(value);
}

export class CheckMobileNumberDto {

     @IsNotEmpty()
     @Transform(({ value }) => normalizeRegistrationPhone(value) ?? '')
     @Matches(/^\d{10,15}$/, { message: 'Enter a valid phone number' })
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