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
const backup_controller_1 = require("./backup-controller");
const encryption_controller_1 = require("./encryption-controller");
const helper_1 = require("../../hooks/helper");
const PrimeWindowAccessController_1 = require("../settings/PrimeWindowAccessController");
const PrimeWindowAccessRepository_1 = __importDefault(require("../../models/settings/users/PrimeWindowAccessRepository"));
const router = express_1.default.Router();
const authController = new authController_1.AuthController();
const checkLicenseAccess = async (req, res, next) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId)
            return res.status(400).json({ status: 'error', message: 'tenantId is required' });
        const repo = new PrimeWindowAccessRepository_1.default(tenantId);
        const isValid = await repo.validateLicense();
        if (!isValid)
            return res.status(403).json({ status: 'error', message: 'License expired or invalid' });
        next();
    }
    catch (error) {
        console.log('License validation error:', error);
        return res.status(500).json({ status: 'error', message: 'License validation failed: ' + error.message });
    }
};
router.post('/api/v1/prime/login', (0, helper_1.handleOverLoad)(checkLicenseAccess), (req, res) => authController.login(req, res));
router.get('/api/v1/prime/validate-token', (0, helper_1.handleOverLoad)(checkLicenseAccess), validateTenancy_1.checkTokenExists, (req, res) => authController.validateToken(req, res));
router.get('/api/v1/prime/validate-user-pin', (0, helper_1.handleOverLoad)(checkLicenseAccess), (req, res) => authController.validateUserPinProvided(req, res));
router.get("/api/v1/security/getloggedsessions", validateTenancy_1.checkTokenExists, validateTenancy_1.isAuthorizedRoleAdmin, handlers_1.getLoggedSessions);
router.get("/api/v1/security/getloggedsessions/update", validateTenancy_1.checkTokenExists, validateTenancy_1.isAuthorizedRoleAdmin, handlers_1.updateLoggedSessions);
router.get("/api/v1/security/user/logout", validateTenancy_1.checkTokenExists, validateTenancy_1.isAuthorizedRoleAdmin, handlers_1.logoutUser);
router.get("/api/v1/security/users/logged/count", validateTenancy_1.checkTokenExists, validateTenancy_1.isAuthorizedRoleAdmin, handlers_1.getLoggedUsersCount);
router.get("/api/v1/security/users/getlogin/history", validateTenancy_1.checkTokenExists, validateTenancy_1.isAuthorizedRoleAdmin, handlers_1.getLoginHistory);
router.get("/api/v1/security/roles/audit-log", validateTenancy_1.checkTokenExists, validateTenancy_1.isAuthorizedRoleAdmin, handlers_1.getRolesAuditLog);
// access request routes
router.post('/api/v1/security-features/request-access', (0, helper_1.handleOverLoad)(result_acess_controller_1.ResultAccessController.requestAccess));
router.put('/api/v1/security-features/grant/:requestId', result_acess_controller_1.ResultAccessController.grantAccess);
router.put('/api/v1/security-features/revoke/:requestId', result_acess_controller_1.ResultAccessController.revokeAccess);
router.get('/api/v1/security-features/history', result_acess_controller_1.ResultAccessController.getAccessHistory);
router.get('/api/v1/security-features/history/:ascensionid/:employeeid', result_acess_controller_1.ResultAccessController.getAccessHistoryByAscensionAndEmployee);
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
// backup routes
router.post('/api/v1/security-features/backup/database', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.createDatabaseBackup));
router.get('/api/v1/security-features/backup/logs', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.getBackupLogs));
router.get('/api/v1/security-features/backup/logs/:id', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.getBackupById));
router.get('/api/v1/security-features/backup/logs/:id/download', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.downloadBackup));
router.get('/api/v1/security-features/backup/stats', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.getBackupStats));
router.delete('/api/v1/security-features/backup/:id', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.deleteBackup));
// backup schedule routes
router.post('/api/v1/security-features/backup/schedules', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.createBackupSchedule));
router.get('/api/v1/security-features/backup/schedules', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.getBackupSchedules));
router.get('/api/v1/security-features/backup/schedules/:id', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.getBackupScheduleById));
router.put('/api/v1/security-features/backup/schedules/:id', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.updateBackupSchedule));
router.delete('/api/v1/security-features/backup/schedules/:id', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.deleteBackupSchedule));
router.post('/api/v1/security-features/backup/schedules/:id/execute', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.executeScheduledBackup));
router.post('/api/v1/security-features/backup/schedules/run-all', (0, helper_1.handleOverLoad)(backup_controller_1.BackupController.runScheduledBackups));
// encryption and security routes
router.get('/api/v1/security-features/backup/security-settings', (0, helper_1.handleOverLoad)(encryption_controller_1.EncryptionController.getSecuritySettings));
router.put('/api/v1/security-features/backup/security-settings', (0, helper_1.handleOverLoad)(encryption_controller_1.EncryptionController.updateSecuritySettings));
router.post('/api/v1/security-features/backup/generate-key', (0, helper_1.handleOverLoad)(encryption_controller_1.EncryptionController.generateEncryptionKey));
router.get('/api/v1/security-features/backup/encryption-keys', (0, helper_1.handleOverLoad)(encryption_controller_1.EncryptionController.getEncryptionKeys));
router.post('/api/v1/security-features/backup/rotate-key', (0, helper_1.handleOverLoad)(encryption_controller_1.EncryptionController.rotateEncryptionKey));
router.post('/api/v1/security-features/backup/:id/decrypt', (0, helper_1.handleOverLoad)(encryption_controller_1.EncryptionController.decryptBackup));
// prime window access routes
router.post('/api/v1/security/license/add', (0, helper_1.handleOverLoad)(PrimeWindowAccessController_1.PrimeWindowAccessController.addLicense));
router.put('/api/v1/security/license/revoke/:id', (0, helper_1.handleOverLoad)(PrimeWindowAccessController_1.PrimeWindowAccessController.revokeLicense));
router.get('/api/v1/security/license/check', (0, helper_1.handleOverLoad)(PrimeWindowAccessController_1.PrimeWindowAccessController.checkLicense));
router.get('/api/v1/security/license/data', (0, helper_1.handleOverLoad)(PrimeWindowAccessController_1.PrimeWindowAccessController.getLicenseData));
exports.default = router;
