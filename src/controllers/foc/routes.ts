import express from 'express';
import { StaffFocController } from './StaffFocController';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireAccountingRole } from '../../middleware/authority';

const router = express.Router();

// Public authenticated FOC endpoints
router.get('/api/v1/foc/accounts/staff/:employeeid', checkTokenExists, StaffFocController.getAccountBalance);
router.post('/api/v1/foc/validate', checkTokenExists, StaffFocController.validateCoverage);
router.post('/api/v1/foc/transactions', checkTokenExists, StaffFocController.processTransaction);

// Query FOC accounts and transactions
router.get('/api/v1/foc/accounts', checkTokenExists, StaffFocController.getAllAccounts);
router.get('/api/v1/foc/transactions', checkTokenExists, requireAccountingRole, StaffFocController.getTransactions);
router.get('/api/v1/foc/reports/summary', checkTokenExists, requireAccountingRole, StaffFocController.getSummaryReport);

// Admin / Approval endpoints
router.put('/api/v1/foc/accounts/staff/:employeeid/limit', checkTokenExists, requireAccountingRole, StaffFocController.updateLimit);
router.post('/api/v1/foc/transactions/:id/approve', checkTokenExists, requireAccountingRole, StaffFocController.approveTransaction);
router.post('/api/v1/foc/transactions/:id/reverse', checkTokenExists, requireAccountingRole, StaffFocController.reverseTransaction);

export default router;
