import { Transform as TransformContactPhone } from 'class-transformer';
import { normalizeRegistrationPhone } from './checkMobileNoDto.dto';
import { MaxLength } from "class-validator";
import {
     IsEmail,
     IsEnum,
     IsInt,
     IsNotEmpty,
     IsOptional,
     IsString,
     IsDateString,
     Min,
     Matches,
     isString,
} from "class-validator";

export enum Gender {
     MALE = "male",
     FEMALE = "female",
}

export enum MaritalStatus {
     SINGLE = "single",
     MARRIED = "married",
}

export enum AgeType {
     DAY = "day",
     DAYS = "days",
     MONTHS = "months",
     YEARS = "years",
}

export enum ContactPointer {
     SELF = "self",
     RELATIVE = "relative",
}


export enum Designation {
     Dr = "Dr",
     Mr = "Mr",
     Mrs = "Mrs",
     Ms = "Ms",
     Miss = "Miss",
     Madam = "Madam",
     Rev = "Rev",
     Prof = "Prof",
     Sir = "Sir",
     Mx = "Mx",
     Sheikh = "Sheikh",
     Sultan = "Sultan",
     Nana = "Nana",
     Baba = "Baba",
     Bibi = "Bibi",
     Pastor = "Pastor",
     Lady = "Lady",
     Chief = "Chief",
     Alhaji = "Alhaji",
     Alhaja = "Alhaja",
     Nun = "Nun",
     Oga = "Oga",
     Barrister = "Barrister",
     Imam = "Imam",
     Other = "Other",
}

export class CreateNewPatientDto {

     @IsString()
     @IsNotEmpty()
     firstname!: string;

     @IsString()
     @IsNotEmpty()
     lastname!: string;

     @IsOptional()
     @IsString()
     middlename?: string;

     @IsString()
     designation!: string;

     @IsOptional()
     @IsEmail()
     email?: string;

     @IsOptional()
     @IsDateString()
     dob?: string;

     @IsInt()
     @IsNotEmpty()
     registeredby!: string;


     @IsInt()
     @Min(0)
     age!: number;

     @IsEnum(AgeType)
     agetype!: AgeType;

     @IsEnum(Gender)
     gender!: Gender;

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

     @IsEnum(ContactPointer)
     contact_pointer!: ContactPointer;

     @IsOptional()
     @Matches(/^(self|mother|father|guardian|relative|other)$/)
     contact_relationship?: string;

     @IsOptional()
     @TransformContactPhone(({ value }) => typeof value === 'string' && value.trim() ? normalizeRegistrationPhone(value) ?? value : value)
     @Matches(/^(?:[0-9]{10,15})?$/)
     backup_phone?: string;

     @IsOptional()
     @IsInt()
     @Min(1)
     backup_patient_id?: number | null;

     @IsOptional()
     @IsString()
     @MaxLength(150)
     backup_contact_name?: string;

     @IsOptional()
     @Matches(/^(self|mother|father|guardian|relative|other)?$/)
     backup_relationship?: string;

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

