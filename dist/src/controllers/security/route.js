"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const handlers_1 = require("./handlers");
const authController_1 = require("./authController");
const validateTenancy_1 = require("../../middleware/validateTenancy");
const router = express_1.default.Router();
const authController = new authController_1.AuthController();
router.post('/api/v1/prime/login', (req, res) => authController.login(req, res));
router.get('/api/v1/prime/validate-token', validateTenancy_1.checkTokenExists, (req, res) => authController.validateToken(req, res));
router.get("/api/v1/security/getloggedsessions", handlers_1.getLoggedSessions);
router.get("/api/v1/security/getloggedsessions/update", handlers_1.updateLoggedSessions);
router.get("/api/v1/security/user/logout", handlers_1.logoutUser);
router.get("/api/v1/security/users/logged/count", handlers_1.getLoggedUsersCount);
router.get("/api/v1/security/users/getlogin/history", handlers_1.getLoginHistory);
exports.default = router;
