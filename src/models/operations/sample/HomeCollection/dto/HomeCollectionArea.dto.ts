import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsBoolean } from "class-validator";

export class HomeCollectionAreaDTO {
     @IsString()
     @IsNotEmpty()
     area_name!: string;

     @IsNumber()
     @Min(0)
     collection_fee!: number;

     @IsOptional()
     @IsBoolean()
     @IsOptional()
     is_active?: boolean;
}