import express, { Router } from "express";
import {
     getLoggedSessions,
     updateLoggedSessions,
     logoutUser,
     getLoggedUsersCount,
     getLoginHistory,
     getRolesAuditLog,
} from "./handlers";
import { AuthController } from "./authController";
import { checkTokenExists, isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";
import { ResultAccessController } from "./result-acess-controller";
import { AccessWindowsController } from "./access-windows-controller";
import { BackupController } from "./backup-controller";
import { EncryptionController } from "./encryption-controller";
import { handleOverLoad } from "../../hooks/helper";
import { PrimeWindowAccessController } from "../settings/PrimeWindowAccessController";
import PrimeWindowAccessRepository from "../../models/settings/users/PrimeWindowAccessRepository";


const router: Router = express.Router();

const authController = new AuthController();


const checkLicenseAccess = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) return res.status(400).json({ status: 'error', message: 'tenantId is required' });
          const repo = new PrimeWindowAccessRepository(tenantId);
          const isValid = await repo.validateLicense();
          if (!isValid) return res.status(403).json({ status: 'error', message: 'License expired or invalid' });
          next();
     } catch (error) {
          console.log('License validation error:', error);
          return res.status(500).json({ status: 'error', message: 'License validation failed: ' + (error as Error).message });
     }
};
router.post('/api/v1/prime/login', handleOverLoad(checkLicenseAccess), (req, res) => authController.login(req, res));
router.get('/api/v1/prime/validate-token', handleOverLoad(checkLicenseAccess), checkTokenExists, (req, res) => authController.validateToken(req, res));
router.get('/api/v1/prime/validate-user-pin', handleOverLoad(checkLicenseAccess), (req, res) => authController.validateUserPinProvided(req as unknown as any, res));



router.get("/api/v1/security/getloggedsessions", checkTokenExists, isAuthorizedRoleAdmin, getLoggedSessions);
router.get("/api/v1/security/getloggedsessions/update", checkTokenExists, isAuthorizedRoleAdmin, updateLoggedSessions);
router.get("/api/v1/security/user/logout", checkTokenExists, isAuthorizedRoleAdmin, logoutUser);
router.get("/api/v1/security/users/logged/count", checkTokenExists, isAuthorizedRoleAdmin, getLoggedUsersCount);
router.get("/api/v1/security/users/getlogin/history", checkTokenExists, isAuthorizedRoleAdmin, getLoginHistory);
router.get("/api/v1/security/roles/audit-log", checkTokenExists, isAuthorizedRoleAdmin, getRolesAuditLog);



// access request routes
router.post('/api/v1/security-features/request-access', handleOverLoad(ResultAccessController.requestAccess));
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

// backup routes
router.post('/api/v1/security-features/backup/database', handleOverLoad(BackupController.createDatabaseBackup));
router.get('/api/v1/security-features/backup/logs', handleOverLoad(BackupController.getBackupLogs));
router.get('/api/v1/security-features/backup/logs/:id', handleOverLoad(BackupController.getBackupById));
router.get('/api/v1/security-features/backup/logs/:id/download', handleOverLoad(BackupController.downloadBackup));
router.get('/api/v1/security-features/backup/stats', handleOverLoad(BackupController.getBackupStats));
router.delete('/api/v1/security-features/backup/:id', handleOverLoad(BackupController.deleteBackup));

// backup schedule routes
router.post('/api/v1/security-features/backup/schedules', handleOverLoad(BackupController.createBackupSchedule));
router.get('/api/v1/security-features/backup/schedules', handleOverLoad(BackupController.getBackupSchedules));
router.get('/api/v1/security-features/backup/schedules/:id', handleOverLoad(BackupController.getBackupScheduleById));
router.put('/api/v1/security-features/backup/schedules/:id', handleOverLoad(BackupController.updateBackupSchedule));
router.delete('/api/v1/security-features/backup/schedules/:id', handleOverLoad(BackupController.deleteBackupSchedule));
router.post('/api/v1/security-features/backup/schedules/:id/execute', handleOverLoad(BackupController.executeScheduledBackup));
router.post('/api/v1/security-features/backup/schedules/run-all', handleOverLoad(BackupController.runScheduledBackups));

// encryption and security routes
router.get('/api/v1/security-features/backup/security-settings', handleOverLoad(EncryptionController.getSecuritySettings));
router.put('/api/v1/security-features/backup/security-settings', handleOverLoad(EncryptionController.updateSecuritySettings));
router.post('/api/v1/security-features/backup/generate-key', handleOverLoad(EncryptionController.generateEncryptionKey));
router.get('/api/v1/security-features/backup/encryption-keys', handleOverLoad(EncryptionController.getEncryptionKeys));
router.post('/api/v1/security-features/backup/rotate-key', handleOverLoad(EncryptionController.rotateEncryptionKey));
router.post('/api/v1/security-features/backup/:id/decrypt', handleOverLoad(EncryptionController.decryptBackup));

// prime window access routes
router.post('/api/v1/security/license/add', handleOverLoad(PrimeWindowAccessController.addLicense));
router.put('/api/v1/security/license/revoke/:id', handleOverLoad(PrimeWindowAccessController.revokeLicense));
router.get('/api/v1/security/license/check', handleOverLoad(PrimeWindowAccessController.checkLicense));
router.get('/api/v1/security/license/data', handleOverLoad(PrimeWindowAccessController.getLicenseData));


export default router;
