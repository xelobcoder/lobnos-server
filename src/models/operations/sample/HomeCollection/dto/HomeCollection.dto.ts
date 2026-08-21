import { IsString, IsNotEmpty, IsIn, IsInt, Min, IsDateString, IsNumber, IsOptional } from "class-validator";

export class HomeCollectionOrderDTO {

     @IsString()
     @IsNotEmpty()
     @IsIn([
          'Pending',
          'Confirmed',
          'Assigned',
          'EnRoute',
          'Collected',
          'Received',
          'Completed',
          'Cancelled'
     ])
     status!: string;

     @IsInt()
     @Min(1)
     patientid!: number;

     @IsDateString()
     @IsNotEmpty()
     appointment_date!: string;

     @IsString()
     @IsNotEmpty()
     appointment_time!: string;

     @IsString()
     @IsNotEmpty()
     address!: string;

     @IsNumber()
     latitude!: number;

     @IsNumber()
     longitude!: number;

     @IsNumber()
     @Min(0)
     collection_fee!: number;

     @IsInt()
     @Min(1)
     @IsOptional()
     assigned_to?: number;
}