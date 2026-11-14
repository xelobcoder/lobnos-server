import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { getAuthUser } from "./authority";

/**
 * Platform middleware adds `employeeid` to authenticated requests for audit and legacy handlers.
 * It is not part of most DTOs, so the whitelist rejects it as an unknown property.
 *
 * We only retry validation without `employeeid` when:
 *  - the first pass failed,
 *  - the supplied value equals the verified session actor, and
 *  - removing it makes the DTO valid.
 *
 * That preserves DTOs that legitimately declare `employeeid` (for example patient credentials and
 * login history) while ignoring the platform-injected audit field everywhere else.
 */
async function validateWithSessionEmployeeId(dtoClass: any, raw: any, request: any) {
     const dtoObject = plainToInstance(dtoClass, raw);
     const errors = await validate(dtoObject, { whitelist: true, forbidNonWhitelisted: true });
     if (errors.length === 0) return { dtoObject, errors };
     if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { dtoObject, errors };

     const actor = getAuthUser(request);
     if (!actor) return { dtoObject, errors };
     const supplied = Number((raw as Record<string, unknown>).employeeid);
     if (!Number.isSafeInteger(supplied) || supplied !== Number(actor.employeeid)) return { dtoObject, errors };

     const cleaned = { ...(raw as Record<string, unknown>) };
     delete cleaned.employeeid;
     const retry: any = plainToInstance(dtoClass, cleaned);
     const retryErrors = await validate(retry, { whitelist: true, forbidNonWhitelisted: true });
     return retryErrors.length === 0 ? { dtoObject: retry, errors: retryErrors } : { dtoObject, errors };
}

export const validateDtoMiddleware = (
     dtoClass: any,
     source: "body" | "query" | "params" = "body"
) => {
     return async (req: any, res: any, next: any) => {
          const { dtoObject, errors } = await validateWithSessionEmployeeId(dtoClass, req[source], req);

          if (errors.length > 0) {
               const errorMessages = errors
                    .flatMap(error => Object.values(error.constraints ?? {}))
                    .join("; ");

               // A rejected DTO is otherwise hard to trace from the client: record the route and the
               // supplied field names (never the values) before returning the validation message.
               console.warn('[validate-dto] rejected', {
                    path: String(req.originalUrl || req.path || '').split('?')[0],
                    source,
                    keys: Object.keys(req[source] || {}),
               });

               return res.status(400).json({
                    status: "error",
                    message: errorMessages,
               });
          }

          req[source] = dtoObject;
          next();
     };
};
