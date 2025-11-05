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
import { BackupController } from "./backup-controller";
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

// backup routes
router.post('/api/v1/security-features/backup/database', handleOverLoad(BackupController.createDatabaseBackup));
router.post('/api/v1/security-features/backup/files', handleOverLoad(BackupController.createFileBackup));
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
router.get('/api/v1/security-features/backup/security-settings', handleOverLoad(BackupController.getSecuritySettings));
router.put('/api/v1/security-features/backup/security-settings', handleOverLoad(BackupController.updateSecuritySettings));
router.post('/api/v1/security-features/backup/generate-key', handleOverLoad(BackupController.generateEncryptionKey));
router.get('/api/v1/security-features/backup/encryption-keys', handleOverLoad(BackupController.getEncryptionKeys));
router.post('/api/v1/security-features/backup/rotate-key', handleOverLoad(BackupController.rotateEncryptionKey));
router.post('/api/v1/security-features/backup/:id/decrypt', handleOverLoad(BackupController.decryptBackup));

export default router;
