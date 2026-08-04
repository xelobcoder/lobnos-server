import {
     IsInt,
     IsNotEmpty,
     IsOptional,
     IsString,
     MaxLength,
     Min,
} from "class-validator";

export class CreatePatientEmergencyContactDto {
     @IsInt()
     @Min(1)
     patientid!: number;

     @IsOptional()
     @IsString()
     @MaxLength(50)
     emmergencyContactName?: string;

     @IsOptional()
     @IsString()
     @MaxLength(50)
     emmergencyContactNumber?: string;

     @IsOptional()
     @IsString()
     @MaxLength(50)
     relationship?: string;

     @IsOptional()
     @IsString()
     @MaxLength(100)
     occupation?: string;

     @IsOptional()
     @IsString()
     @MaxLength(100)
     address?: string;
}



export class UpdatePatientEmergencyContactDto {
     @IsInt()
     @Min(1)
     patientid!: number;
     
     @IsOptional()
     @IsString()
     @MaxLength(50)
     emmergencyContactName?: string;

     @IsOptional()
     @IsString()
     @MaxLength(50)
     emmergencyContactNumber?: string;


     @IsOptional()
     @IsString()
     @MaxLength(50)
     relationship?: string;


     @IsOptional()
     @IsString()
     @MaxLength(100)
     occupation?: string;


     @IsOptional()
     @IsString()
     @MaxLength(100)
     address?: string;
}

