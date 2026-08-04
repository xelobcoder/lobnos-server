import { Transform } from "class-transformer";
import { IsInt, Min, IsNotEmpty, IsString, Matches } from "class-validator";

export class PatientCredentialsDto {
     @Transform(({ value }) => {
          if (typeof value === "string" && value.length > 0) {
               return Number(value);
          }
          return value;
     })
     @IsInt({ message: "patientid must be a valid number" })
     @Min(1)
     patientid!: number;



     @IsNotEmpty()
     @IsString()
     @Matches(/^[a-zA-Z0-9]{6,}$/, {
          message: "password must be at least 6 characters long and contain only letters and numbers",
     })
     opassword!: string;



     @IsNotEmpty()
     @IsString()
     @Matches(/^[a-zA-Z0-9]{6,}$/, {
          message: "password must be at least 6 characters long and contain only letters and numbers",
     })
     npassword!: string;



     @IsNotEmpty()
     @IsString()
     @Matches(/^[a-zA-Z0-9]{6,}$/, {
          message: "password must be at least 6 characters long and contain only letters and numbers",
     })
     nppassword!: string;


     @IsInt({ message: "employeeid must be a valid number" })
     @Min(1)
     employeeid!: number;


     @IsNotEmpty()
     @IsString()
     providedUsername!: string;

}