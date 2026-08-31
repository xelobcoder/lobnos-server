import express from "express";
import {
     getLogins,
     getUser,
     createAccount,
     deleteAccountHandler,
     updateBasicInfo,
     authenticateUser,
     activateUser,
     getUserPermissions,
     updatePermissions,
     authenticateClinician,
     authenticateClinicianPortal,
     authenticatePatientPortal,
     resetStaffPasswordHandler,
     logoutUser,
} from "./authHandlers";
import { checkTokenExists, isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";

const router = express.Router();

router.get("/api/v1/logins", getLogins);
router.get("/api/v1/logins/user", getUser);
router.post("/api/v1/logins", createAccount);
router.delete("/api/v1/logins", deleteAccountHandler);
router.post("/api/v1/logins/update", isAuthorizedRoleAdmin, updateBasicInfo);
router.post("/api/v1/logins/update/user-updates", updateBasicInfo);
router.post("/api/v1/logins/reset-password", checkTokenExists, resetStaffPasswordHandler);
router.post("/api/v1/authenticate", authenticateUser);
router.put("/api/v1/user/authentication/activate", activateUser);
router.get("/api/v1/user/permissions", getUserPermissions);
router.put("/api/v1/user/permissions", updatePermissions);
router.post("/api/v1/login/clinicians", authenticateClinician);
router.post("/api/v1/login/clinician", authenticateClinicianPortal);
router.post("/api/v1/login/patient", authenticatePatientPortal);
router.post("/api/v1/logins/logout", logoutUser);



export default router;