import { IsString, IsNotEmpty, IsBoolean, IsOptional, Min, IsInt } from "class-validator";

export class HomeCollectionChecklistDTO {

     @IsString()
     @IsNotEmpty()
     checklist_item!: string;

     @IsBoolean()
     @IsOptional()
     is_completed?: boolean;


     @IsInt()
     @Min(1)
     home_collection_id!: number;



     @IsInt()
     @Min(1)
     completed_by!: number;
}