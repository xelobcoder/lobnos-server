import {
     IsBoolean,
     IsInt,
     IsNotEmpty,
     IsOptional,
     IsString,
     IsDate,
     MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLoginLogDTO {
     @IsInt()
     @IsNotEmpty()
     employeeid!: number;

     @IsString()
     @IsNotEmpty()
     @MaxLength(100)
     loginSessionId!: string;

     @IsOptional()
     @IsDate()
     @Type(() => Date)
     logoutTime?: Date;

     @IsOptional()
     @IsDate()
     @Type(() => Date)
     actualLogout?: Date;

     @IsString()
     @IsNotEmpty()
     browserInformation!: string;

     @IsOptional()
     @IsBoolean()
     loggedout?: boolean;
}


export class UpdateLoginLogDTO {
     @IsOptional()
     @IsDate()
     @Type(() => Date)
     logoutTime?: Date;

     @IsOptional()
     @IsDate()
     @Type(() => Date)
     actualLogout?: Date;

     @IsOptional()
     @IsBoolean()
     loggedout?: boolean;
}