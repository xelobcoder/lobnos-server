"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const handlers_1 = require("./handlers");
const authController_1 = require("./authController");
const validateTenancy_1 = require("../../middleware/validateTenancy");
const result_acess_controller_1 = require("./result-acess-controller");
const access_windows_controller_1 = require("./access-windows-controller");
const helper_1 = require("../../hooks/helper");
const router = express_1.default.Router();
const authController = new authController_1.AuthController();
router.post('/api/v1/prime/login', (req, res) => authController.login(req, res));
router.get('/api/v1/prime/validate-token', validateTenancy_1.checkTokenExists, (req, res) => authController.validateToken(req, res));
router.get('/api/v1/prime/validate-user-pin', (req, res) => authController.validateUserPinProvided(req, res));
router.get("/api/v1/security/getloggedsessions", handlers_1.getLoggedSessions);
router.get("/api/v1/security/getloggedsessions/update", handlers_1.updateLoggedSessions);
router.get("/api/v1/security/user/logout", handlers_1.logoutUser);
router.get("/api/v1/security/users/logged/count", handlers_1.getLoggedUsersCount);
router.get("/api/v1/security/users/getlogin/history", handlers_1.getLoginHistory);
// access request routes
router.post('/api/v1/security-features/request-access', result_acess_controller_1.ResultAccessController.requestAccess);
router.put('/api/v1/security-features/grant/:requestId', result_acess_controller_1.ResultAccessController.grantAccess);
router.put('/api/v1/security-features/revoke/:requestId', result_acess_controller_1.ResultAccessController.revokeAccess);
router.get('/api/v1/security-features/history', result_acess_controller_1.ResultAccessController.getAccessHistory);
router.post('/api/v1/security-features/verify', result_acess_controller_1.ResultAccessController.verifyAccess);
router.post('/api/v1/security-features/expire', result_acess_controller_1.ResultAccessController.expireExpiredRequests);
// access windows routes
router.get('/api/v1/security-features/access-windows/:id', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.getAccessWindow));
router.post('/api/v1/security-features/access-windows', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.createAccessWindow));
router.get('/api/v1/security-features/access-windows', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.getAllAccessWindows));
router.get('/api/v1/security-features/access-windows/employee/:employeeid', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.getAccessWindowByEmployee));
router.get('/api/v1/security-features/access-windows/effective/:employeeid', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.getEffectiveSettings));
router.put('/api/v1/security-features/access-windows/:id', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.updateAccessWindow));
router.delete('/api/v1/security-features/access-windows/:id', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.deleteAccessWindow));
router.delete('/api/v1/security-features/access-windows/employee/:employeeid', (0, helper_1.handleOverLoad)(access_windows_controller_1.AccessWindowsController.deleteAccessWindowByEmployee));
exports.default = router;
