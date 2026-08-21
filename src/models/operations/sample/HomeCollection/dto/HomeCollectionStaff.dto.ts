import { IsString, IsNotEmpty, IsInt, Min, IsOptional, IsBoolean } from "class-validator";

export class HomeCollectionStaffDTO {

     @IsInt()
     @Min(1)
     employeeid!: number;

     @IsString()
     @IsNotEmpty()
     vehicle_number!: string;


     @IsBoolean()
     @IsOptional()
     is_available?: boolean;
}