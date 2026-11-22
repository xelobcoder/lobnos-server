import { randomUUID } from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import KnexConnection from "../../database/KnexConnections";
import { singleTenantKnexInstance } from "../../database/connection";
import { configuration } from "../../hooks/configuration";
import AuthenticationRepository from "../settings/users/AuthenticationRepository";
import { FacilityError } from "./FacilityInput";
import { FacilityManagementService } from "./FacilityManagementService";
import { TenantRegistry } from "./TenantRegistry";
import { ensureSupportColumn, ensureDeveloperSupportIdentity } from "./DeveloperSupportIdentity";
import { DEVELOPER_SUPPORT_EMAIL, SUPPORT_SESSION_SECONDS } from "./DeveloperSessionPolicy";

export class DeveloperTenantSessionService {
     private management = new FacilityManagementService();

     async open(tenantId: number, owner: JwtPayload, previousToken?: unknown) {
          const target = await new TenantRegistry().getTenant(tenantId);
          if (!target?.isActive) throw new FacilityError("Choose an active client facility", 409);
          const localDatabaseName = singleTenantKnexInstance.client.config?.connection?.database;
          if (tenantId === configuration.defaultTenantId && target.databaseName !== localDatabaseName) {
               throw new FacilityError("The configured local tenant does not match its registered database", 409);
          }
          if (!configuration.isMultiTenant &&
               (tenantId !== configuration.defaultTenantId || target.databaseName !== localDatabaseName)) {
               throw new FacilityError("Developer sessions are limited to the registered local facility in single-tenant mode", 409);
          }
          const lifetime = Math.min(SUPPORT_SESSION_SECONDS, Math.floor(Number(owner.exp) - Date.now() / 1000));
          if (owner.master !== true || !Number.isSafeInteger(lifetime) || lifetime <= 0 || !owner.sid)
               throw new FacilityError("The developer session has expired", 401);
          if (previousToken) await this.close(owner, previousToken);

          const db = await KnexConnection(tenantId);
          await ensureSupportColumn(db);
          const expiry = new Date(Date.now() + lifetime * 1000);
          const sessionId = randomUUID();
          const support = await db.transaction(async (trx) => {
               const row = await ensureDeveloperSupportIdentity(trx);
               await trx("loginlogs")
                    .where({ employeeid: row.employeeid, loggedout: false })
                    .update({ loggedout: true, logoutTime: trx.fn.now() });
               await trx("loginlogs").insert({
                    employeeid: row.employeeid,
                    loginSessionId: sessionId,
                    logoutTime: expiry,
                    browserInformation: JSON.stringify({
                         type: "platform-developer",
                         ownerEmployeeId: owner.employeeid,
                    }),
               });
               return row;
          });
          try {
               const accessToken = await new AuthenticationRepository(tenantId).generateAccessToken(
                    support.email,
                    {
                         tid: tenantId,
                         employeeid: Number(support.employeeid),
                         sid: sessionId,
                         arv: Number(support.access_revision || 0),
                         developerOwner: { masterSessionId: owner.sid },
                    },
                    lifetime,
               );
               await this.management.recordDeveloperSession(
                    tenantId,
                    { tid: owner.tid, employeeid: owner.employeeid },
                    "developer_session_opened",
                    Number(support.employeeid),
                    sessionId,
               );
               return { tenantId, accessToken, sessionExpiryTime: expiry.toISOString(), loginsessionId: sessionId };
          } catch (error) {
               await db("loginlogs")
                    .where({ loginSessionId: sessionId })
                    .update({ loggedout: true, logoutTime: db.fn.now() });
               throw error;
          }
     }

     async close(owner: JwtPayload, token: unknown) {
          if (typeof token !== "string" || !process.env.ACCESS_TOKEN_SECRET)
               throw new FacilityError("A developer session is required", 400);
          let claims: JwtPayload;
          try {
               const value = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
                    ignoreExpiration: true,
                    algorithms: ["HS256"],
               });
               if (typeof value === "string") throw new Error("Invalid session");
               claims = value;
          } catch {
               throw new FacilityError("Invalid developer session", 403);
          }
          const parent = claims.developerOwner;
          if (
               owner.master !== true ||
               parent?.masterSessionId !== owner.sid ||
               claims.email !== DEVELOPER_SUPPORT_EMAIL ||
               !Number.isSafeInteger(claims.tid) ||
               (!configuration.isMultiTenant && claims.tid !== configuration.defaultTenantId) ||
               !Number.isSafeInteger(claims.employeeid) ||
               typeof claims.sid !== "string"
          ) {
               throw new FacilityError("This developer session belongs to another account", 403);
          }
          const tenantId = Number(claims.tid);
          const db = await KnexConnection(tenantId);
          await db("loginlogs")
               .where({ employeeid: claims.employeeid, loginSessionId: claims.sid })
               .update({ loggedout: true, logoutTime: db.fn.now() });
          await this.management.recordDeveloperSession(
               tenantId,
               { tid: owner.tid, employeeid: owner.employeeid },
               "developer_session_closed",
               Number(claims.employeeid),
               claims.sid,
          );
     }
}
