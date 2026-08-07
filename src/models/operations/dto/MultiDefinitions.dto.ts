import { Transform } from "class-transformer"
import { IsNotEmpty, IsString, IsInt, Min } from "class-validator"

export class CreateTestConditionDefinitionDto {
     @IsNotEmpty()
     @IsString()
     conditionName!: string

     @Transform(({ value }) => parseInt(value, 10))
     @IsNotEmpty()
     @IsInt()
     @Min(1)
     testid!: number


     @Transform(({ value }) => parseInt(value, 10))
     @IsNotEmpty()
     @IsInt()
     @Min(1)
     createdBy!: number
}
