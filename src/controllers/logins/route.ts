import express from "express";
import {
     getLogins,
     getUser,
     createAccount,
     deleteAccountHandler,
     updateBasicInfo,
     activateUser,
     getUserPermissions,
     updatePermissions,
     authenticateClinicianPortal,
     authenticatePatientPortal,
     resetStaffPasswordHandler,
     logoutUser,
} from "./authHandlers";
import { checkTokenExists, isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";
import { resolveLoginTenant } from "../../middleware/resolveLoginTenant";
import { handleOverLoad } from "../../hooks/helper";
import { requireOwnerRole } from "../../middleware/authority";

const router = express.Router();

router.get("/api/v1/logins", getLogins);
router.get("/api/v1/logins/user", getUser);
router.post("/api/v1/logins", requireOwnerRole, createAccount);
router.delete("/api/v1/logins", requireOwnerRole, deleteAccountHandler);
router.post("/api/v1/logins/update", isAuthorizedRoleAdmin, updateBasicInfo);
router.post("/api/v1/logins/update/user-updates", updateBasicInfo);
router.post("/api/v1/logins/reset-password", checkTokenExists, resetStaffPasswordHandler);
router.put("/api/v1/user/authentication/activate", requireOwnerRole, activateUser);
router.get("/api/v1/user/permissions", checkTokenExists, requireOwnerRole, handleOverLoad(getUserPermissions));
router.put("/api/v1/user/permissions", checkTokenExists, requireOwnerRole, updatePermissions);
// Login is by username only; the tenant is resolved from the username (no email logins).
router.post("/api/v1/login/clinician",  handleOverLoad(resolveLoginTenant('clinician')), handleOverLoad(authenticateClinicianPortal));
router.post("/api/v1/login/patient", handleOverLoad(resolveLoginTenant('patient')), handleOverLoad(authenticatePatientPortal));
router.post("/api/v1/logins/logout", logoutUser);



export default router;