import User from "../LobnosAuth/user";
import { Request, response, Response } from "express";
import { customError, responseError, paginationQuery, promisifyQuery, rowAffected } from "../hooks/helper";
import { OperationsFailures } from "../models/operations/types";
import Security from "../models/security/securityClass";
import { PrimeLimsTableroles } from "../database/DatabaseTableSchema";
import logger from "../hooks/logger";
import RolesRepository from "../models/settings/users/RolesRepository";
import { TiifuWorkingClass } from "../database/TiifuWorkingClass";
import KnexConnection from "../database/KnexConnections";
import knex from "knex";

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
          permissions?: any;
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
          role: "scientist" | "sonographer" | "admin" | "manager" | "phelobotomist",
          branch: string;
          pin: string;
          altMobile: string;
          dob: string;
          startDate: string;
          accessLevel: string;
          department: string;
          employeeId: string;
          address: string;
     },
     query: {
          tenantId: string;
     },
}

const createNewAccount = async (req: NewAccountRequest): Promise<{ userId: number }> => {
     try {
          const { name, password, role, email, branch } = req.body;

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
               updated_on: new Date(),
               date_created: new Date(),
               activation: 1,
               pin: req.body.pin ? parseInt(req.body.pin) : 0,
          });

          return { userId: insertResult };
     } catch (error:any) {
          logger.error(error);
          // never send my sql errors to the client
          throw new Error(error?.message || "Error creating user account");
     }
};

const userLogin = async (req: UserRequest, res: Response) => {
     try {
          const { name, password, email, browserInformation } = req.body;
          const user = new User(name, password, null, null, null);
          const tenantId = parseInt(req.query.tenantId);
          const userExist = await user.checkLogins(email, password, tenantId);

          if (!userExist) return customError("Invalid Login credentials", 400, res);

          const userInformation = await user.getUserDataUsingEmail(email, tenantId);
          const employeeId = userInformation["employeeid"];
          const security = new Security(employeeId);

          const isLoggedMultipleDevices = await security.getCanInitiateLogin(tenantId);
          if (!isLoggedMultipleDevices) {
               return res.send({ status: "multipleLogins" });
          }

          if (userInformation) {
               const userNeededData = await user.processUserData(userInformation, tenantId);
               if (typeof userNeededData === "string") {
                    return customError(userNeededData, 404, res);
               }

               const token = await user.createAccessTokenCredentials(
                    process.env.ACCESS_TOKEN_SECRET!,
                    email,
                    userNeededData,
                    `${security.loginDuration}h`
               );

               const sessionExpiryTime = await security.insertLoginHistory(tenantId, browserInformation);

               res.send({
                    status: "success",
                    statusCode: 200,
                    message: "Login successful",
                    user: userNeededData,
                    token,
                    sessionExpiryTime,
                    vitalsInformation: await new User().loggedInAccessoryInformation(employeeId, tenantId)
               });
          } else {
               customError(`user not found`, 404, res);
          }
     } catch (err) {
          console.log(err)
          responseError(res);
     }
};

const getAllLogins = async (tenantId: number, records: {
     name: string,
     email: string,
     role: string,
     sortby: 'ASC' | 'DESC',
     page: number,
     count: number
}): Promise<PrimeLimsTableroles[] | any> => {
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

          return result;
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
     const queryString = `DELETE FROM roles WHERE EMPLOYEEID = ?`;
     const result = await promisifyQuery(tenantId, queryString, [parseInt(id)]);
     if (rowAffected(result)) {
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
          const queryString = `SELECT employeeid, username, role, email, branch, emailAuthenticated, activation, mobile, alternativeMobile, dob, updated_on, date_created, pin FROM roles WHERE employeeid = ?`;

          const result = await promisifyQuery(tenantIdP, queryString, [parseInt(id)]);
          res.send({ result, message: "success", statusCode: 200 });
     } catch (err) {
          logger.error(err);
          responseError(res);
     }
};

const updateUserBasicInfo = async (body: UserRequest['body'], tenantId: number, isUser: boolean = false): Promise<number> => {
     const { employeeid, name, email, role, branch, pin, cpassword, password, dob, altMobile, mobile, alternativeMobile } = body;
     const roleRepo = new RolesRepository(tenantId);

     if (isUser && !cpassword) throw new Error("current password is required");
     if (isUser && password) {

          const currentEmployee = await roleRepo.getRoleById(parseInt(employeeid));
          const currentPaswordHash = currentEmployee?.password;
          if (!currentPaswordHash) throw new Error("current password not found");
          const isSame = await roleRepo.isPasswordSame(cpassword, currentPaswordHash);
          if (!isSame) throw new Error("current password is not same");

     }

     const knex = await KnexConnection(tenantId);
     const passwordHash = await roleRepo.hashPassword(password);


     const isPinUnique = await knex('roles')
          .where('pin', pin)
          .andWhereNot('employeeid', employeeid)
          .first();

     if (isPinUnique) {
          throw new Error("PIN is already in use");
     }

     try {
          return await knex('roles')
               .where('employeeid', employeeid)
               .update({
                    username: name,
                    email: email,
                    mobile: mobile || "",
                    alternativeMobile: altMobile || alternativeMobile || null,
                    role: role,
                    branch: parseInt(branch),
                    password: passwordHash,
                    pin: pin ? parseInt(pin.toString()) : null,
                    dob: dob || null,
               });
     } catch (error) {
          logger.error(error);
          throw error;
     }
};

const activateAUser = async (req: UserRequest, res: Response) => {
     try {
          const { id, currentv } = req.body;
          if (!id) return res.send({ status: 400, message: "Bad Request" });

          const queryString = `UPDATE roles SET ACTIVATION = ? WHERE EMPLOYEEID = ?`;
          const tenantId = parseInt(req.query.tenantId);
          const status = await promisifyQuery(tenantId, queryString, [currentv, id]);
          res.status(200).send({
               statusCode: 200,
               status: "success",
               message: rowAffected(status) ? "record updated successfully" : "record not updated",
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
          const queryString = `UPDATE roles SET PERMISSIONS = ? WHERE EMPLOYEEID = ?`;
          const tenantId = parseInt(req.query.tenantId);
          const update = await promisifyQuery(tenantId, queryString, [JSON.stringify(permissions), parseInt(id!)]);
          if (rowAffected(update)) {
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
     userLogin,
     getAUser,
     updateUserBasicInfo,
     deleteAccount,
     activateAUser,
     getPermissions,
     updateUserPermission,
};


