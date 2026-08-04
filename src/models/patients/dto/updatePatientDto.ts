import {
     IsDateString,
     IsEmail,
     IsEnum,
     IsInt,
     isNotEmpty,
     IsNotEmpty,
     IsOptional,
     IsString,
     Matches,
     Min,
} from "class-validator";
import { AgeType, ContactPointer, Designation, Gender, MaritalStatus } from "./newPatientDto";

export class UpdatePatientDto {

     @IsOptional()
     @IsString()
     firstname?: string;

     @IsOptional()
     @IsString()
     lastname?: string;

     @IsOptional()
     @IsString()
     middlename?: string;

     @IsOptional()
     @IsString()
     designation?: Designation;

     @IsOptional()
     @IsEmail()
     email?: string;

     @IsOptional()
     @IsDateString()
     dob?: string;

     @IsOptional()
     @IsInt()
     @Min(0)
     age?: number;

     @IsOptional()
     @IsEnum(AgeType)
     agetype?: AgeType;

     @IsOptional()
     @IsEnum(Gender)
     gender?: Gender;

     @IsOptional()
     @IsEnum(MaritalStatus)
     marital_status?: MaritalStatus;

     @IsOptional()
     @Matches(/^\d{10}$/, {
          message: "mobile_number must contain exactly 10 digits",
     })
     mobile_number?: string;

     @IsOptional()
     @Matches(/^\d{10}$/, {
          message: "whatAppcontact must contain exactly 10 digits",
     })
     whatAppcontact?: string;

     @IsOptional()
     @IsString()
     occupation?: string;

     @IsOptional()
     @IsString()
     organization?: string;

     @IsInt()
     @IsNotEmpty()
     registeredby!: number;



     @IsOptional()
     @IsEnum(ContactPointer)
     contact_pointer?: ContactPointer;

     @IsOptional()
     @IsString()
     relativecontactname?: string;

     @IsOptional()
     @Matches(/^\d{10,14}$/, {
          message: "relativecontactnumber must be between 10 and 14 digits",
     })
     relativecontactnumber?: string;

     @IsOptional()
     @Matches(/^\+\d{1,4}$/, {
          message: "Invalid country code",
     })
     whatsapp_country_code?: string;

     @IsOptional()
     @Matches(/^\+\d{1,4}$/, {
          message: "Invalid country code",
     })
     mobile_country_code?: string;

}