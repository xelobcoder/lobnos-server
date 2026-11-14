import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { normalizeRegistrationPhone } from './checkMobileNoDto.dto';

export class PatientPhoneContactDto {
     @Transform(({ value }) => typeof value === 'string' ? normalizeRegistrationPhone(value) ?? value : value)
     @IsString()
     @Matches(/^\d{10,15}$/)
     phone!: string;

     @IsIn(['self', 'mother', 'father', 'guardian', 'relative', 'other'])
     relationship!: string;

     @IsOptional()
     @IsString()
     @MaxLength(150)
     contact_name?: string | null;

     @IsOptional()
     @IsInt()
     @Min(1)
     owner_patient_id?: number | null;
}
