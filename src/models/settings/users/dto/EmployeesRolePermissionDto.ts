import { Transform } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";

export class EmployeesRolePermissionDto {
     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     roleId?: number;

     @IsOptional()
     @Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value))
     @IsInt()
     permissionId?: number;
}
