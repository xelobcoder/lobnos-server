import { createHmac, timingSafeEqual } from "crypto";
import { Knex } from "knex";
import { LoginEntityType } from "./TenantLoginDirectory";

/** Call only in the transaction that updates the password. */
export async function revokePasswordSessions(trx: Knex.Transaction, type: LoginEntityType, id: number): Promise<void> {
     if (type === "staff") {
          const now = new Date();
          await trx("loginlogs").where({ employeeid: id }).update({
               loggedout: true,
               logoutTime: now,
               actualLogout: now,
          });
          await trx("roles").where({ employeeid: id }).update({ refresh_token: null });
     } else if (type === "patient" && (await trx.schema.hasTable("patient_portal_accounts"))) {
          await trx("patient_portal_accounts").where({ patientid: id }).increment("session_version", 1);
     }
     // Clinician tokens are bound to the credential hash. Updating the password
     // in this transaction invalidates them without a separate revocation write.
}

/** Do not expose the stored password hash itself in a readable JWT. */
export function clinicianCredentialVersion(passwordHash: string): string {
     const secret = process.env.ACCESS_TOKEN_SECRET;
     if (!secret || !passwordHash) throw new Error("Clinician credentials are unavailable");
     return createHmac("sha256", secret).update("clinician-session:").update(passwordHash).digest("hex");
}

export function clinicianCredentialMatches(version: unknown, passwordHash: string): boolean {
     if (typeof version !== "string" || !/^[a-f0-9]{64}$/.test(version) || !passwordHash) return false;
     return timingSafeEqual(Buffer.from(version, "hex"), Buffer.from(clinicianCredentialVersion(passwordHash), "hex"));
}
