import { Transform } from "class-transformer"
import { IsNotEmpty, IsString, Min, IsInt } from "class-validator"


export class CreateTestFieldsCategoryDto {
     @IsNotEmpty()
     @IsString()
     categoryname!: string

     @Transform(({ value }) => parseInt(value, 10))
     @IsNotEmpty()
     @IsInt()
     @Min(1)
     testid!: number


     @IsNotEmpty()
     @IsInt()
     @Min(1)
     createdby!: number
}