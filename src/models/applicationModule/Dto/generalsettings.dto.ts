import { IsOptional, IsString, Min } from "class-validator";
import { ApplicationBillSettings } from "../../application/appsettings/Type";

export class ApplicationGeneralSettingsDto {
     @IsOptional()
     @IsString()
     @Min(0, { message: "bulkregistration must be a non-empty string" })
     bulkregistration?: boolean;


     @IsOptional()
     @IsString()
     @Min(0, { message: "fontSize must be a non-empty string" })
     fontSize?: number;


     @IsOptional()
     @IsString()
     @Min(0, { message: "textColor must be a non-empty string" })
     textColor?: string;

     @IsOptional()
     @IsString()
     @Min(0, { message: "backgroundColor must be a non-empty string" })
     backgroundColor?: string;


     @IsOptional()
     @IsString()
     @Min(0, { message: "DeactivateBilling24hrs must be a non-empty string" })
     DeactivateBilling24hrs?: string

     @IsOptional()
     @IsString()
     @Min(0, { message: "PaidBillsBeforeTransaction must be a non-empty string" })
     PaidBillsBeforeTransaction?: boolean;


     @IsOptional()
     @IsString()
     @Min(0, { message: "completeFlow must be a non-empty string" })
     completeFlow?: boolean;


     @IsOptional()
     @IsString()
     @Min(0, { message: "approvalbeforeprinting must be a non-empty string" })
     approvalbeforeprinting?: boolean;

     @IsOptional()
     @IsString()
     @Min(0, { message: "show_watermark must be a non-empty string" })
     show_watermark?: boolean;

     @IsOptional()
     @IsString()
     @Min(0, { message: "pinOnResultValidation must be a non-empty string" })
     pinOnResultValidation?: boolean

     @IsOptional()
     @IsString()
     @Min(0, { message: "pinOnResultEntry must be a non-empty string" })
     pinOnResultEntry?: boolean

     @IsOptional()
     @IsString()
     @Min(0, { message: "withnessRefund must be a non-empty string" })
     withnessRefund?: boolean

     @IsOptional()
     @IsString()
     @Min(0, {message: ""})
     smsActivated?: boolean

     
     allowScientistToRegisterClient?: boolean
     allowManagerToRefund?: boolean
     makepdfprintingcompulsory?: boolean
     patientIdGenerationMethod?: "prefix" | "region"
     patientIdPrefix?: string | null



}