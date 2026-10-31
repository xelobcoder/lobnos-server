import User from "../LobnosAuth/user";
import { Request, response, Response } from "express";
import { customError, responseError, paginationQuery, promisifyQuery, rowAffected } from "../hooks/helper";
import { OperationsFailures } from "../models/operations/types";
import Security from "../models/security/securityClass";
import logger from "../hooks/logger";
import RolesRepository from "../models/settings/users/RolesRepository";
import RolesAuditRepository from "../models/settings/users/RolesAuditRepository";
import { TiifuWorkingClass } from "../database/TiifuWorkingClass";
import KnexConnection from "../database/KnexConnections";
import knex from "knex";
import { NotificationDispatcher } from "../models/application/notifications/services/NotificationDispatcher";
import { formatTenantLoginUsername } from "../models/auth/TenantLoginUsername";

export interface UserRequest extends Request {
     body: {
          name?: string;
          password?: string;
          cpassword?: string;
          role?: string;
          email?: string;
          branch?: string;
          id?: string;
          tenantId: string;
          currentv?: string;
          employeeid?: string;
          browserInformation?: string;
          mobile?: string;
          altMobile?: string;
          alternativeMobile?: string;
          dob?: string;
          pin?: string | number;
          startDate?: string;
          accessLevel?: string;
          employeeId?: string;
          department?: string;
          address?: string;
     };
     query: {
          name?: string;
          email?: string;
          contact?: string;
          role?: string;
          tenantId: string,
          id?: string;
     };
}



export interface NewAccountRequest {
     body: {
          name: string;
          email: string;
          mobile: string;
          password: string;
          cpassword: string;
          role: "marketer" | "scientist" | "sonographer" | "head_of_laboratory" | "head_of_imaging" | "admin" | "manager" | "phelobotomist",
          branch: string;
          pin: string;
          altMobile: string;
          dob: string;
          startDate: string;
          accessLevel: string;
          department: string;
          employeeId: string;
          address: string;
          designation: string;
          firstname: string;
          middlename?: string;
          lastname: string;
     },
     query: {
          tenantId: string;
     },
}

const createNewAccount = async (req: NewAccountRequest): Promise<{ userId: number; loginUsername?: string }> => {
     try {
          const { name, password, role, email, branch, designation, firstname, middlename, lastname } = req.body;

          const tenantId = parseInt(req.query.tenantId);
          const user = new RolesRepository(tenantId);

          const userExistsUsingEmail = await user.getRoleByEmail(email);
          if (userExistsUsingEmail) throw new Error(OperationsFailures.resourceExist + ".User already exists");

          const correctEmailFormat = TiifuWorkingClass.isEmailValidEmail(email);
          if (!correctEmailFormat) throw new Error(OperationsFailures.invalidEmailFormat);

          // phone number verification and validation
          const isPhoneNumberValid = TiifuWorkingClass.isNumberPhoneNumber(req.body.mobile);
          if (!isPhoneNumberValid) throw new Error(OperationsFailures.invalidPhoneNumber);
          const isMobileNumberExist = await user.verifyMobileNumber(req.body.mobile);
          if (isMobileNumberExist) throw new Error(OperationsFailures.resourceExist + ".Mobile number already exists");

          const connection = await KnexConnection(tenantId);


          const isPinUnique = await connection('roles')
               .where('pin', req.body.pin)
               .first();

          if (isPinUnique) {
               throw new Error("PIN is already in use");
          }
          const hashedPassword = await user.hashPassword(password);

          const insertResult = await user.createRole({
               username: name,
               password: hashedPassword,
               role,
               email,
               branch: parseInt(branch),
               emailAuthenticated: "false",
               mobile: req.body.mobile || "",
               alternativeMobile: req.body.altMobile || null,
               dob: req.body.dob || null,
               firstname: firstname || null,
               middlename: middlename || null,
               lastname: lastname || null,
               staff_designation: designation || null,
               updated_on: new Date(),
               date_created: new Date(),
               activation: 1,
               pin: req.body.pin ? parseInt(req.body.pin) : 0,
          });

          const loginUsername = await formatTenantLoginUsername(tenantId, 'staff', Number(insertResult));
          await connection('roles').where({ employeeid: insertResult }).update({ login_username: loginUsername });

          const createdRow = await connection("roles")
               .select([
                    "employeeid",
                    "username",
                    "role",
                    "pin",
                    "date_created",
                    "time",
                    "activation",
                    "email",
                    "updated_on",
                    "emailAuthenticated",
                    "branch",
                    "mobile",
                    "alternativeMobile",
                    "dob",
                    "firstname",
                    "middlename",
                    "lastname",
                    "staff_designation"
               ])
               .where({ employeeid: insertResult })
               .first();

          const actorEmployeeidRaw = (req as any)?.body?.employeeid || (req as any)?.body?.employeeId;
          const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;

          await RolesAuditRepository.insertAudit({
               tenantId,
               action: "INSERT",
               employeeid: insertResult,
               actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
               oldData: null,
               newData: RolesAuditRepository.sanitizeRoleRow(createdRow)
          });

          NotificationDispatcher.dispatch(tenantId, 'USER_CREATED', { userId: Number(insertResult) }, actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : undefined).catch((err) => {
               logger.error('USER_CREATED notification dispatch failed', err);
          });

          return { userId: insertResult, loginUsername };
     } catch (error: any) {
          logger.error(error);
          // never send my sql errors to the client
          throw new Error(error?.message || "Error creating user account");
     }
};

const getAllLogins = async (tenantId: number, records: {
     name: string,
     email: string,
     role: string,
     sortby: 'ASC' | 'DESC',
     page: number,
     count: number
}): Promise<any[] | any> => {
     const { name, email, role, sortby = 'DESC', page, count } = records
     try {
          let query = `
      SELECT
        rl.employeeid,
        rl.username,
     rl.role,
        rl.email,
        rl.branch,
        b.name AS branchname,
        rl.emailAuthenticated,
        rl.activation
      FROM roles AS rl
      LEFT JOIN branch AS b ON rl.branch = b.branchid
    `;
          const vals: any[] = [];
          const conditions: string[] = [];

          if (name) {
               conditions.push("rl.username LIKE ?");
               vals.push(`%${name}%`);
          }

          if (email) {
               conditions.push("rl.email LIKE ?");
               vals.push(`%${email}%`);
          }

          if (role) {
               conditions.push("rl.role = ?");
               vals.push(role);
          }

          if (conditions.length > 0) {
               query += ` WHERE ${conditions.join(" AND ")}`;
          }


          if (count && page) {
               query += ` ORDER BY rl.employeeid ${sortby} LIMIT ? OFFSET ?`;
          }


          let result = [];

          result = count && page ? await paginationQuery({ count, page }, query, vals, tenantId) : await promisifyQuery(tenantId, query, vals)

          return await Promise.all(result.map(async (row: any) => ({
               ...row,
               loginUsername: await formatTenantLoginUsername(tenantId, 'staff', Number(row.employeeid)),
          })));
     } catch (err) {
          console.log(err)
          return customError("something wrong occurred", 301, response);
     }
};

const deleteAccount = async (req: UserRequest, res: Response): Promise<void> => {
     const { id } = req.body;
     if (!id) {
          res.status(400).send({ status: 400, message: "Bad Request" });
          return;
     }
     const tenantId = parseInt(req.query.tenantId);
     const conn = await KnexConnection(tenantId);
     const targetEmployeeid = parseInt(id.toString(), 10);
     const oldRow = await conn("roles")
          .select([
               "employeeid",
               "username",
               "role",
               "pin",
               "date_created",
               "time",
               "activation",
               "email",
               "updated_on",
               "emailAuthenticated",
               "branch",
               "mobile",
               "alternativeMobile",
               "dob"
          ])
          .where({ employeeid: targetEmployeeid })
          .first();

     const result = await conn("roles").where({ employeeid: targetEmployeeid }).del();
     if (result > 0) {
          const actorEmployeeidRaw = (req.body as any)?.employeeid || (req.body as any)?.employeeId || (req.query as any)?.employeeid;
          const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
          await RolesAuditRepository.insertAudit({
               tenantId,
               action: "DELETE",
               employeeid: targetEmployeeid,
               actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
               oldData: RolesAuditRepository.sanitizeRoleRow(oldRow),
               newData: null
          });

          res.status(200).send({
               statusCode: 200,
               status: "success",
               message: "employee record deleted successfully",
          });
     } else {
          res.status(200).send({
               statusCode: 200,
               status: "success",
               message: "",
          });
     }
};

const getAUser = async (req: UserRequest, res: Response): Promise<void> => {
     try {
          const { id, tenantId } = req.query;
          const tenantIdP = parseInt(tenantId.toString())
          if (!id) return customError("employeeid required", 404, res);
          const queryString = `SELECT employeeid, username, role, email, branch, emailAuthenticated, activation, mobile, alternativeMobile, dob, updated_on, date_created, pin, firstname, middlename, lastname, staff_designation AS designation FROM roles WHERE employeeid = ?`;

          const result = await promisifyQuery(tenantIdP, queryString, [parseInt(id)]);
          const formatted = Array.isArray(result)
               ? await Promise.all(result.map(async (row: any) => ({
                    ...row,
                    loginUsername: await formatTenantLoginUsername(tenantIdP, 'staff', Number(row.employeeid)),
               })))
               : result;
          res.send({ result: formatted, message: "success", statusCode: 200 });
     } catch (err) {
          logger.error(err);
          responseError(res);
     }
};

const updateUserBasicInfo = async (body: any, tenantId: number, isUser: boolean = false): Promise<number> => {
     const { employeeid, name, email, role, branch, pin, cpassword, password, dob, altMobile, mobile, alternativeMobile, firstname, middlename, lastname, designation } = body;
     const roleRepo = new RolesRepository(tenantId);
     const employeeId = Number(employeeid);

     if (isUser && !cpassword) throw new Error("current password is required");
     if (isUser && password) {

          const currentEmployee = await roleRepo.getRoleById(employeeId);
          const currentPaswordHash = currentEmployee?.password;
          if (!currentPaswordHash) throw new Error("current password not found");
          const isSame = await roleRepo.isPasswordSame(cpassword, currentPaswordHash);
          if (!isSame) throw new Error("current password is not same");

     }


     const knex = await KnexConnection(tenantId);
     const passwordHash = password ? await roleRepo.hashPassword(password) : null;


     const isPinUnique = await knex('roles')
          .where('pin', pin)
          .andWhereNot('employeeid', employeeid)
          .first();

     if (isPinUnique) {
          throw new Error("PIN is already in use");
     }

     try {
          const targetEmployeeid = parseInt(employeeid.toString(), 10);
          const oldRow = await knex("roles")
               .select([
                    "employeeid",
                    "username",
                    "role",
                    "pin",
                    "date_created",
                    "time",
                    "activation",
                    "email",
                    "updated_on",
                    "emailAuthenticated",
                    "branch",
                    "mobile",
                    "alternativeMobile",
                    "dob",
                    "firstname",
                    "middlename",
                    "lastname",
                    "staff_designation"
               ])
               .where({ employeeid: targetEmployeeid })
               .first();

          const updatePayload: Record<string, any> = {
               username: name,
               email: email,
               mobile: mobile || "",
               alternativeMobile: altMobile || alternativeMobile || null,
               role: role,
               branch: parseInt(branch),
               pin: pin ? parseInt(pin.toString()) : null,
               dob: dob || null,
               firstname: firstname || null,
               middlename: middlename || null,
               lastname: lastname || null,
               staff_designation: designation || null,
          };

          if (passwordHash) {
               updatePayload.password = passwordHash;
          }

          const updateCount = await knex('roles')
               .where('employeeid', employeeid)
               .update(updatePayload);

          if (updateCount > 0) {
               const newRow = await knex("roles")
                    .select([
                         "employeeid",
                         "username",
                         "role",
                         "pin",
                         "date_created",
                         "time",
                         "activation",
                         "email",
                         "updated_on",
                         "emailAuthenticated",
                         "branch",
                         "mobile",
                         "alternativeMobile",
                         "dob",
                         "firstname",
                         "middlename",
                         "lastname",
                         "staff_designation"
                    ])
                    .where({ employeeid: targetEmployeeid })
                    .first();

               const actorEmployeeidRaw = (body as any)?.employeeId || (body as any)?.updated_by_employeeid || (body as any)?.actor_employeeid || body.employeeid;
               const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
               await RolesAuditRepository.insertAudit({
                    tenantId,
                    action: "UPDATE",
                    employeeid: targetEmployeeid,
                    actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
                    oldData: RolesAuditRepository.sanitizeRoleRow(oldRow),
                    newData: RolesAuditRepository.sanitizeRoleRow(newRow)
               });
          }

          return updateCount;
     } catch (error) {
          logger.error(error);
          throw error;
     }
};

const activateAUser = async (req: UserRequest, res: Response) => {
     try {
          const { id, currentv } = req.body;
          if (!id) return res.send({ status: 400, message: "Bad Request" });

          const tenantId = parseInt(req.query.tenantId);
          const conn = await KnexConnection(tenantId);
          const targetEmployeeid = parseInt(id.toString(), 10);
          const oldRow = await conn("roles")
               .select([
                    "employeeid",
                    "username",
                    "role",
                    "pin",
                    "date_created",
                    "time",
                    "activation",
                    "email",
                    "updated_on",
                    "emailAuthenticated",
                    "branch",
                    "mobile",
                    "alternativeMobile",
                    "dob"
               ])
               .where({ employeeid: targetEmployeeid })
               .first();

          const status = await conn("roles")
               .where({ employeeid: targetEmployeeid })
               .update({ activation: currentv });

          if (status > 0) {
               const newRow = await conn("roles")
                    .select([
                         "employeeid",
                         "username",
                         "role",
                         "pin",
                         "date_created",
                         "time",
                         "activation",
                         "email",
                         "updated_on",
                         "emailAuthenticated",
                         "branch",
                         "mobile",
                         "alternativeMobile",
                         "dob"
                    ])
                    .where({ employeeid: targetEmployeeid })
                    .first();

               const actorEmployeeidRaw = (req.body as any)?.employeeid || (req.body as any)?.employeeId || (req.query as any)?.employeeid;
               const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
               await RolesAuditRepository.insertAudit({
                    tenantId,
                    action: "UPDATE",
                    employeeid: targetEmployeeid,
                    actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
                    oldData: RolesAuditRepository.sanitizeRoleRow(oldRow),
                    newData: RolesAuditRepository.sanitizeRoleRow(newRow)
               });

               const activated = String(currentv) === '1' || String(currentv).toLowerCase() === 'true';
               if (activated) {
                    NotificationDispatcher.dispatch(
                         tenantId,
                         'USER_ACTIVATED',
                         { userId: targetEmployeeid },
                         actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : undefined,
                    ).catch(() => { });
               }
          }
          res.status(200).send({
               statusCode: 200,
               status: "success",
               message: status > 0 ? "record updated successfully" : "record not updated",
          });

     } catch (error) {
          res.status(400).send({ statusCode: 301, message: "error occurred" });
     }
};

const getPermissions = async (tenantId: number, employeeid: number, res: Response): Promise<any> => {
     const userClass = new User(null, null, null, null, null);
     const user = await userClass.userExistWithId(tenantId, employeeid);
     if (!user) {
          return OperationsFailures.notFound;
     }

     const userData = user[0];

     const obj: Record<string, any> = {};

     for (const [key, value] of Object.entries(userData)) {
          if (key === "permissions") {
               obj[key.toLowerCase()] = value ? JSON.parse(value as string) : {};
          }
     }
     return obj;
};

const updateUserPermission = async (req: UserRequest, res: Response): Promise<void> => {
     try {
          const { id } = req.query;
          const permissions = req.body;
          const tenantId = parseInt(req.query.tenantId);
          const conn = await KnexConnection(tenantId);
          const targetEmployeeid = parseInt(id!, 10);
          const oldRow = await conn("roles")
               .select([
                    "employeeid",
                    "username",
                    "role",
                    "pin",
                    "date_created",
                    "time",
                    "activation",
                    "email",
                    "updated_on",
                    "emailAuthenticated",
                    "branch",
                    "mobile",
                    "alternativeMobile",
                    "dob"
               ])
               .where({ employeeid: targetEmployeeid })
               .first();

          const update = await conn("roles")
               .where({ employeeid: targetEmployeeid })
               .update({ permissions: JSON.stringify(permissions) });

          if (update > 0) {
               const newRow = await conn("roles")
                    .select([
                         "employeeid",
                         "username",
                         "role",
                         "pin",
                         "date_created",
                         "time",
                         "activation",
                         "email",
                         "updated_on",
                         "emailAuthenticated",
                         "branch",
                         "mobile",
                         "alternativeMobile",
                         "dob"
                    ])
                    .where({ employeeid: targetEmployeeid })
                    .first();

               const actorEmployeeidRaw = (req.body as any)?.employeeid || (req.body as any)?.employeeId || (req.query as any)?.employeeid;
               const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
               await RolesAuditRepository.insertAudit({
                    tenantId,
                    action: "UPDATE",
                    employeeid: targetEmployeeid,
                    actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
                    oldData: RolesAuditRepository.sanitizeRoleRow(oldRow),
                    newData: RolesAuditRepository.sanitizeRoleRow(newRow)
               });

               res.send({ statusCode: 200, message: "updated successfully", status: "success" });
          } else {
               res.send({ statusCode: 404, status: "error", message: "error updating records" });
          }
     } catch (err) {
          logger.error(err);
          responseError(res);
     }
};

export {
     createNewAccount,
     getAllLogins,
     getAUser,
     updateUserBasicInfo,
     deleteAccount,
     activateAUser,
     getPermissions,
     updateUserPermission,
};
