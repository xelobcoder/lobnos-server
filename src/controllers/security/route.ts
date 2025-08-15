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


export default router;
