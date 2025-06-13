
import { NextFunction, Request, Response } from "express";
import { customError, responseError } from "../hooks/helper";
import { OperationsFailures } from "../models/operations/types";
import { TenancyRepository } from "../models/Tenancy/tenancyRepo";
import { configuration } from "../hooks/configuration";
import TokenValidator from "../models/settings/users/TokenValidator";
import RolesRepository from "../models/settings/users/RolesRepository";


export const checkTokenExists = async (request: Request, response: Response, next: NextFunction) => {
     const token = request.headers['x-auth-prime'] as string;
     if (!token) {
          return customError('Token not provided', 401, response);
     }

     try {
          const isValid = await new TokenValidator().validateAccessToken(token);
          if (!isValid) return customError("Invalid Token Provided", 404, response);
          if (!isValid.expired) return customError('Token expired', 401, response);
          next();
     } catch (error) {
          return customError('Invalid token', 401, response);
     }
};

export const ValidateTenancyAgreement = async (request: Request<{}, {}, {}, { tenantId: number }>, response: Response, next: NextFunction) => {
     try {
          if (configuration.isMultiTenant) {
               const { tenantId } = request.query;
               if (!tenantId) {
                    return customError(OperationsFailures.invalidResquestQuery + ' TenantId not found', 404, response);
               }
               const status = await new TenancyRepository().validateTenantStanding(tenantId);
               if (!status) return customError(OperationsFailures.dontHaveAccessPermission, 404, response);
          } else {
               if (!request.query.tenantId) {
                    request.query.tenantId = 1;
               }
          }
          next();
     } catch (err) {
          console.log(err);
     }
}


export const isAuthorizedRoleScientistPhelobotomist = async (request: Request, response: Response, next: NextFunction) => {
     try {
          const { tenantId } = request.query;
          const employeeid = request.query.employeeid;
          if (!employeeid || !employeeid) return customError("invalid request query provided", 400, response)
          const tenantIdP = parseInt(tenantId.toString());
          const parsedEmployeeid = parseInt(employeeid.toString())
          const userdata = await new RolesRepository(tenantIdP).getRoleById(parsedEmployeeid);
          const role = userdata ? userdata['role'].toLowerCase().trim() : ''
          const allowedRoles = ["phelobotomist", 'admin', 'manager', 'scientist'];
          if (!allowedRoles.includes(role)) {
               return customError(OperationsFailures.dontHaveAccessPermission, 404, response);
          }
          next();
         
     } catch (err) {
          responseError(response);
     }
}


export const isAuthorizedRoleAdmin = async (request: Request, response: Response, next: NextFunction) => {
     try {
          const { tenantId} = request.query;
          const employeeid = request.query.employeeid || request.body.employeeid;
          if (!employeeid) return customError("invalid request query provided", 400, response)
          const tenantIdP = parseInt(tenantId.toString());
          const parsedEmployeeid = parseInt(employeeid.toString())
          const userdata = await new RolesRepository(tenantIdP).getRoleById(parsedEmployeeid);
          const role = userdata ? userdata['role'].toLowerCase().trim() : ''
          const allowedRoles = ['admin' ];
          if (!allowedRoles.includes(role)) {
               return customError(OperationsFailures.dontHaveAccessPermission, 404, response);
          }
          next();
         
     } catch (err) {
          responseError(response);
     }
}

