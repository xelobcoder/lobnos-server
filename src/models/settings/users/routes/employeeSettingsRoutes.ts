import express from 'express';
import { validateDtoMiddleware } from '../../../../middleware/validateDto.middleware';
import { EmployeesDocumentDto, EmployeesEmergencyContactDtoPost } from '../dto';
import { employeeDocumentUpload } from '../controllers/EmployeesDocumentsController';
import EmployeesAttendanceController from '../controllers/EmployeesAttendanceController';
import EmployeesBankAccountsController from '../controllers/EmployeesBankAccountsController';
import EmployeesCertificationsController from '../controllers/EmployeesCertificationsController';
import EmployeesContactsController from '../controllers/EmployeesContactsController';
import EmployeesCredentialsController from '../controllers/EmployeesCredentialsController';
import EmployeesDesignationsController from '../controllers/EmployeesDesignationsController';
import EmployeesDocumentsController from '../controllers/EmployeesDocumentsController';
import EmployeesEducationsController from '../controllers/EmployeesEducationsController';
import EmployeesEmergencyContactsController from '../controllers/EmployeesEmergencyContactsController';
import EmployeesEmploymentHistoryController from '../controllers/EmployeesEmploymentHistoryController';
import EmployeesLicensesController from '../controllers/EmployeesLicensesController';
import EmployeesPerformanceReviewsController from '../controllers/EmployeesPerformanceReviewsController';
import EmployeesRoleAssignmentsController from '../controllers/EmployeesRoleAssignmentsController';
import EmployeesRolePermissionsController from '../controllers/EmployeesRolePermissionsController';

const router = express.Router();

router.get('/api/v1/employees/designations', EmployeesDesignationsController.list);
router.post('/api/v1/employees/designations', EmployeesDesignationsController.create);
router.get('/api/v1/employees/designations/:id', EmployeesDesignationsController.getById);
router.put('/api/v1/employees/designations/:id', EmployeesDesignationsController.update);
router.delete('/api/v1/employees/designations/:id', EmployeesDesignationsController.remove);

router.get('/api/v1/employees/:employeeId/credentials', EmployeesCredentialsController.listByEmployee);
router.post('/api/v1/employees/credentials', EmployeesCredentialsController.create);
router.get('/api/v1/employees/credentials/:id', EmployeesCredentialsController.getById);
router.put('/api/v1/employees/credentials/:id', EmployeesCredentialsController.update);
router.delete('/api/v1/employees/credentials/:id', EmployeesCredentialsController.remove);

router.get('/api/v1/employees/:employeeId/contacts', EmployeesContactsController.listByEmployee);
router.post('/api/v1/employees/contacts', EmployeesContactsController.create);
router.get('/api/v1/employees/contacts/:id', EmployeesContactsController.getById);
router.put('/api/v1/employees/contacts/:id', EmployeesContactsController.update);
router.delete('/api/v1/employees/contacts/:id', EmployeesContactsController.remove);

router.get('/api/v1/employees/:employeeId/role-assignments', EmployeesRoleAssignmentsController.listByEmployee);
router.get('/api/v1/employees/role-assignments/by-role/:roleId', EmployeesRoleAssignmentsController.listByRole);
router.post('/api/v1/employees/role-assignments', EmployeesRoleAssignmentsController.create);
router.delete('/api/v1/employees/:employeeId/role-assignments/:roleId', EmployeesRoleAssignmentsController.remove);

router.get('/api/v1/employees/role-permissions/:roleId', EmployeesRolePermissionsController.listByRole);
router.post('/api/v1/employees/role-permissions', EmployeesRolePermissionsController.create);
router.delete('/api/v1/employees/role-permissions/:roleId/:permissionId', EmployeesRolePermissionsController.remove);

router.get('/api/v1/employees/:employeeId/educations', EmployeesEducationsController.listByEmployee);
router.post('/api/v1/employees/educations', EmployeesEducationsController.create);
router.get('/api/v1/employees/educations/:id', EmployeesEducationsController.getById);
router.put('/api/v1/employees/educations/:id', EmployeesEducationsController.update);
router.delete('/api/v1/employees/educations/:id', EmployeesEducationsController.remove);

router.get('/api/v1/employees/:employeeId/licenses', EmployeesLicensesController.listByEmployee);
router.post('/api/v1/employees/licenses', EmployeesLicensesController.create);
router.get('/api/v1/employees/licenses/:id', EmployeesLicensesController.getById);
router.put('/api/v1/employees/licenses/:id', EmployeesLicensesController.update);
router.delete('/api/v1/employees/licenses/:id', EmployeesLicensesController.remove);

router.get('/api/v1/employees/:employeeId/certifications', EmployeesCertificationsController.listByEmployee);
router.post('/api/v1/employees/certifications', EmployeesCertificationsController.create);
router.get('/api/v1/employees/certifications/:id', EmployeesCertificationsController.getById);
router.put('/api/v1/employees/certifications/:id', EmployeesCertificationsController.update);
router.delete('/api/v1/employees/certifications/:id', EmployeesCertificationsController.remove);

router.get('/api/v1/employees/:employeeId/employment-history', EmployeesEmploymentHistoryController.listByEmployee);
router.post('/api/v1/employees/employment-history', EmployeesEmploymentHistoryController.create);
router.get('/api/v1/employees/employment-history/:id', EmployeesEmploymentHistoryController.getById);
router.put('/api/v1/employees/employment-history/:id', EmployeesEmploymentHistoryController.update);
router.delete('/api/v1/employees/employment-history/:id', EmployeesEmploymentHistoryController.remove);

router.get('/api/v1/employees/:employeeId/emergency-contacts', EmployeesEmergencyContactsController.listByEmployee);
router.post('/api/v1/employees/emergency-contacts', validateDtoMiddleware(EmployeesEmergencyContactDtoPost, 'body'), EmployeesEmergencyContactsController.create);
router.get('/api/v1/employees/emergency-contacts/:id', EmployeesEmergencyContactsController.getById);
router.put('/api/v1/employees/emergency-contacts/:id', validateDtoMiddleware(EmployeesEmergencyContactDtoPost, 'body'), EmployeesEmergencyContactsController.update);
router.delete('/api/v1/employees/emergency-contacts/:id', EmployeesEmergencyContactsController.remove);

router.get('/api/v1/employees/:employeeId/documents', EmployeesDocumentsController.listByEmployee);
router.post('/api/v1/employees/documents', employeeDocumentUpload.single('file'), validateDtoMiddleware(EmployeesDocumentDto, 'body'), EmployeesDocumentsController.create);
router.get('/api/v1/employees/documents/:id', EmployeesDocumentsController.getById);
router.get('/api/v1/employees/documents/:id/download', EmployeesDocumentsController.download);
router.put('/api/v1/employees/documents/:id', employeeDocumentUpload.single('file'), validateDtoMiddleware(EmployeesDocumentDto, 'body'), EmployeesDocumentsController.update);
router.delete('/api/v1/employees/documents/:id', EmployeesDocumentsController.remove);

router.get('/api/v1/employees/:employeeId/bank-accounts', EmployeesBankAccountsController.listByEmployee);
router.post('/api/v1/employees/bank-accounts', EmployeesBankAccountsController.create);
router.get('/api/v1/employees/bank-accounts/:id', EmployeesBankAccountsController.getById);
router.put('/api/v1/employees/bank-accounts/:id', EmployeesBankAccountsController.update);
router.delete('/api/v1/employees/bank-accounts/:id', EmployeesBankAccountsController.remove);

router.get('/api/v1/employees/:employeeId/attendance', EmployeesAttendanceController.listByEmployee);
router.post('/api/v1/employees/attendance', EmployeesAttendanceController.create);
router.get('/api/v1/employees/attendance/:id', EmployeesAttendanceController.getById);
router.put('/api/v1/employees/attendance/:id', EmployeesAttendanceController.update);
router.delete('/api/v1/employees/attendance/:id', EmployeesAttendanceController.remove);

router.get('/api/v1/employees/:employeeId/performance-reviews', EmployeesPerformanceReviewsController.listByEmployee);
router.post('/api/v1/employees/performance-reviews', EmployeesPerformanceReviewsController.create);
router.get('/api/v1/employees/performance-reviews/:id', EmployeesPerformanceReviewsController.getById);
router.put('/api/v1/employees/performance-reviews/:id', EmployeesPerformanceReviewsController.update);
router.delete('/api/v1/employees/performance-reviews/:id', EmployeesPerformanceReviewsController.remove);

export default router;
