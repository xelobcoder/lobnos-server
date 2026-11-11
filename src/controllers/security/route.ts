import express, { Router } from "express";
import {
	getLoggedSessions,
	updateLoggedSessions,
	logoutUser,
	getLoggedUsersCount,
	getLoginHistory,
	getRolesAuditLog,
	forceLogoutSession,
} from "./handlers";
import { AuthController } from "./authController";
import { createRateLimiter } from '../../middleware/rateLimiter';
import { checkTokenExists, isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";
import { ResultAccessController } from "./result-acess-controller";
import { AccessWindowsController } from "./access-windows-controller";
import { BackupController } from "./backup-controller";
import { EncryptionController } from "./encryption-controller";
import { handleOverLoad } from "../../hooks/helper";
import { PrimeWindowAccessController } from "../settings/PrimeWindowAccessController";
import PrimeWindowAccessRepository from "../../models/settings/users/PrimeWindowAccessRepository";
import { resolveLoginTenant } from "../../middleware/resolveLoginTenant";
import { requestPasswordResetOtp, resetPasswordWithOtp, verifyPasswordResetOtp } from "../logins/authHandlers";
import { licenseMode } from "../../licensing/storage";
import { requireOwnerRole } from "../../middleware/authority";
import { customError } from "../../hooks/helper";
import {staffAccessOperation as staffAccess,switchStaffRole,refreshStaffRoleSession} from './StaffAccessController';
import {TenantRegistry} from '../../models/Tenancy/TenantRegistry';
import {getAuthUser} from '../../middleware/authority';


const router: Router = express.Router();

const authController = new AuthController();


const checkLicenseAccess = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
	try {
		// In signed mode login/token recovery stays reachable; the global operational gate
		// checks the intersection on all non-exempt APIs. Legacy behavior is unchanged.
		if (licenseMode() === 'signed') return next();
		const tenantId = parseInt(req.query.tenantId as string);
		if (!tenantId) return res.status(400).json({ status: 'error', message: 'tenantId is required' });
		const repo = new PrimeWindowAccessRepository(tenantId);
		const isValid = await repo.validateLicense();
		if (!isValid) return res.status(403).json({ status: 'error', message: 'License expired or invalid' });
		next();
	} catch (error) {
		return res.status(500).json({ status: 'error', message: 'License validation failed' });
	}
};


router.post('/api/v1/prime/login', createRateLimiter({ windowMs: 60_000, max: 120 }), handleOverLoad(resolveLoginTenant('staff')), handleOverLoad(checkLicenseAccess), handleOverLoad((req: any, res: any) => authController.login(req, res)));
router.post('/api/v1/prime/forgotpassword', handleOverLoad(requestPasswordResetOtp));
router.post('/api/v1/prime/verify-reset-otp', handleOverLoad(verifyPasswordResetOtp));
router.post('/api/v1/prime/resetpassword', handleOverLoad(resetPasswordWithOtp));
router.get('/api/v1/prime/validate-token', handleOverLoad(checkLicenseAccess), handleOverLoad(checkTokenExists), (req, res) => authController.validateToken(req, res));
router.post('/api/v1/prime/validate-user-pin', handleOverLoad(checkLicenseAccess), handleOverLoad(checkTokenExists), (req, res) => authController.validateUserPinProvided(req, res));
router.get('/api/v1/prime/my-roles',checkTokenExists,staffAccess(s=>s.mine()));
router.post('/api/v1/prime/switch-role',checkTokenExists,switchStaffRole);
router.post('/api/v1/prime/refresh-role-session',checkTokenExists,refreshStaffRoleSession);
router.get('/api/v1/prime/staff-access',checkTokenExists,staffAccess(s=>s.directory()));
router.post('/api/v1/prime/staff-access',checkTokenExists,staffAccess(async(s,r)=>s.create(r.body,(await new TenantRegistry().requireTenant(getAuthUser(r)!.tenantId)).platformId)));
router.post('/api/v1/prime/staff-access/:id/roles',checkTokenExists,staffAccess((s,r)=>s.grant(r.params.id,r.body)));
router.post('/api/v1/prime/staff-access/:id/activation',checkTokenExists,staffAccess((s,r)=>s.activation(r.params.id,r.body)));
router.delete('/api/v1/prime/staff-access/:id/roles/:assignmentId',checkTokenExists,staffAccess((s,r)=>s.revoke(r.params.id,String(r.params.assignmentId))));



router.get("/api/v1/security/getloggedsessions", handleOverLoad(checkTokenExists), isAuthorizedRoleAdmin, handleOverLoad(getLoggedSessions));
router.get("/api/v1/security/getloggedsessions/update", handleOverLoad(checkTokenExists), isAuthorizedRoleAdmin, handleOverLoad(updateLoggedSessions));
router.get("/api/v1/security/user/logout", handleOverLoad(checkTokenExists), isAuthorizedRoleAdmin, handleOverLoad(logoutUser));
router.get("/api/v1/security/users/logged/count", handleOverLoad(checkTokenExists), isAuthorizedRoleAdmin, getLoggedUsersCount);
router.get("/api/v1/security/users/getlogin/history", handleOverLoad(checkTokenExists), isAuthorizedRoleAdmin, handleOverLoad(getLoginHistory));
router.post("/api/v1/security/sessions/:sessionKey/force-logout", handleOverLoad(checkTokenExists), isAuthorizedRoleAdmin, handleOverLoad(forceLogoutSession));
router.get("/api/v1/security/roles/audit-log", handleOverLoad(checkTokenExists), isAuthorizedRoleAdmin, handleOverLoad(getRolesAuditLog));



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
router.use('/api/v1/security-features/backup', requireOwnerRole);
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
// Preserve legacy renewal contracts. In signed mode protect recovery renewal writes
// (and diagnostic reads) using the actual authenticated administrator.
router.use('/api/v1/security/license', (req, res, next) => {
	try {
		if (licenseMode() === 'legacy') return next();
		return checkTokenExists(req, res, () => requireOwnerRole(req, res, next));
	} catch { return customError('LICENSE_MODE_INVALID', 503, res); }
});
router.post('/api/v1/security/license/add', handleOverLoad(PrimeWindowAccessController.addLicense));
router.put('/api/v1/security/license/revoke/:id', handleOverLoad(PrimeWindowAccessController.revokeLicense));
router.get('/api/v1/security/license/check', handleOverLoad(PrimeWindowAccessController.checkLicense));
router.get('/api/v1/security/license/data', handleOverLoad(PrimeWindowAccessController.getLicenseData));


export default router;
