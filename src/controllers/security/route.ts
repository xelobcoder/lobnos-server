import express, { Router } from "express";
import {
     getLoggedSessions,
     updateLoggedSessions,
     logoutUser,
     getLoggedUsersCount,
     getLoginHistory,
} from "./handlers";
import { AuthController } from "./authController";
import { checkTokenExists } from "../../middleware/validateTenancy";
import { ResultAccessController } from "./result-acess-controller";
import { AccessWindowsController } from "./access-windows-controller";
import { handleOverLoad } from "../../hooks/helper";


const router: Router = express.Router();

const authController = new AuthController();
router.post('/api/v1/prime/login', (req, res) => authController.login(req, res));
router.get('/api/v1/prime/validate-token', checkTokenExists, (req, res) => authController.validateToken(req, res));
router.get('/api/v1/prime/validate-user-pin', (req, res) => authController.validateUserPinProvided(req as unknown as any, res));



router.get("/api/v1/security/getloggedsessions", getLoggedSessions);
router.get("/api/v1/security/getloggedsessions/update", updateLoggedSessions);
router.get("/api/v1/security/user/logout", logoutUser);
router.get("/api/v1/security/users/logged/count", getLoggedUsersCount);
router.get("/api/v1/security/users/getlogin/history", getLoginHistory);



// access request routes
router.post('/api/v1/security-features/request-access', ResultAccessController.requestAccess);
router.put('/api/v1/security-features/grant/:requestId', ResultAccessController.grantAccess);
router.put('/api/v1/security-features/revoke/:requestId', ResultAccessController.revokeAccess);
router.get('/api/v1/security-features/history', ResultAccessController.getAccessHistory);
router.get('/api/v1/security-features/history/:ascensionid/:employeeid', ResultAccessController.getAccessHistoryByAscensionAndEmployee);
router.post('/api/v1/security-features/verify', ResultAccessController.verifyAccess);
router.post('/api/v1/security-features/expire', ResultAccessController.expireExpiredRequests);

// access windows routes
router.get('/api/v1/security-features/access-windows/:id', handleOverLoad(AccessWindowsController.getAccessWindow));
router.post('/api/v1/security-features/access-windows', handleOverLoad(AccessWindowsController.createAccessWindow));
router.get('/api/v1/security-features/access-windows', handleOverLoad(AccessWindowsController.getAllAccessWindows));
router.get('/api/v1/security-features/access-windows/employee/:employeeid', handleOverLoad(AccessWindowsController.getAccessWindowByEmployee));
router.get('/api/v1/security-features/access-windows/effective/:employeeid', handleOverLoad(AccessWindowsController.getEffectiveSettings));
router.put('/api/v1/security-features/access-windows/:id', handleOverLoad(AccessWindowsController.updateAccessWindow));
router.delete('/api/v1/security-features/access-windows/:id', handleOverLoad(AccessWindowsController.deleteAccessWindow));
router.delete('/api/v1/security-features/access-windows/employee/:employeeid', handleOverLoad(AccessWindowsController.deleteAccessWindowByEmployee));

export default router;
