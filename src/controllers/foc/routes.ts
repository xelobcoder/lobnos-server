import express from 'express';
import { StaffFocController } from './StaffFocController';
import { checkTokenExists, isAuthorizedRoleAdminOrAccountant } from '../../middleware/validateTenancy';

const router = express.Router();

// Public authenticated FOC endpoints
router.get('/api/v1/foc/accounts/staff/:employeeid', checkTokenExists, StaffFocController.getAccountBalance);
router.post('/api/v1/foc/validate', checkTokenExists, StaffFocController.validateCoverage);
router.post('/api/v1/foc/transactions', checkTokenExists, StaffFocController.processTransaction);

// Query FOC accounts and transactions
router.get('/api/v1/foc/accounts', checkTokenExists, StaffFocController.getAllAccounts);
router.get('/api/v1/foc/transactions', checkTokenExists, isAuthorizedRoleAdminOrAccountant, StaffFocController.getTransactions);
router.get('/api/v1/foc/reports/summary', checkTokenExists, isAuthorizedRoleAdminOrAccountant, StaffFocController.getSummaryReport);

// Admin / Approval endpoints
router.put('/api/v1/foc/accounts/staff/:employeeid/limit', checkTokenExists, isAuthorizedRoleAdminOrAccountant, StaffFocController.updateLimit);
router.post('/api/v1/foc/transactions/:id/approve', checkTokenExists, isAuthorizedRoleAdminOrAccountant, StaffFocController.approveTransaction);
router.post('/api/v1/foc/transactions/:id/reverse', checkTokenExists, isAuthorizedRoleAdminOrAccountant, StaffFocController.reverseTransaction);

export default router;
