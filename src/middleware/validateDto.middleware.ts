import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

export const validateDtoMiddleware = (
     dtoClass: any,
     source: "body" | "query" | "params" = "body"
) => {
     return async (req: any, res: any, next: any) => {
          const dtoObject = plainToInstance(dtoClass, req[source]);

          const errors = await validate(dtoObject, {
               whitelist: true,
               forbidNonWhitelisted: true,
          });


          if (errors.length > 0) {
               const errorMessages = errors
                    .flatMap(error => Object.values(error.constraints ?? {}))
                    .join("; ");

               return res.status(400).json({
                    status: "error",
                    message: errorMessages,
               });
          }

          req[source] = dtoObject;
          next();
     };
};