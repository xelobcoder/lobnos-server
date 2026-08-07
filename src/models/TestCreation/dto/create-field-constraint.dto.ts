import {
     IsEnum,
     IsInt,
     IsOptional,
     IsString,
     MaxLength,
} from "class-validator";
import { ConstraintAction, ConstraintType } from "../entities/FieldConstraints.entity";


export class CreateFieldConstraintDto {
     @IsInt()
     testid!: number;

     @IsInt()
     fieldid!: number;

     @IsEnum(ConstraintAction)
     action!: ConstraintAction;

     @IsEnum(ConstraintType)
     constraint_type!: ConstraintType;

     @IsOptional()
     @IsString()
     replacement_text?: string | null;

     @IsOptional()
     @IsString()
     @MaxLength(255)
     value?: string;

     @IsOptional()
     @IsString()
     @MaxLength(255)
     prefix?: string;

     @IsOptional()
     @IsString()
     @MaxLength(255)
     suffix?: string;
}