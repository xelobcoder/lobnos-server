import express from 'express';
const router = express.Router();
import {
  handleGetDepartments,
  handleAddNewDepartment,
  handleUpdateDepartment,
  handleDeleteDepartment,
  handleGetSpecificDepartment
} from "./handlers/departmenthandlers";

import {
  getCompanyInfoHandler,
  getCompanyImageHandler,
  AddCompanyInfoHandler,
  handleUploadCompanyImage
} from "./handlers/companyhandler";
import { handleOverLoad } from '../../hooks/helper';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireCompanyImageAdmin } from './handlers/companyImageAccess';

// Department routes
router.get("/api/v1/departments", handleGetDepartments);
router.post("/api/v1/departments", handleOverLoad(handleAddNewDepartment));
router.put("/api/v1/departments", handleOverLoad(handleUpdateDepartment));
router.delete("/api/v1/departments", handleOverLoad(handleDeleteDepartment));
router.get('/api/v1/departments/:id', handleOverLoad(handleGetSpecificDepartment));

// Company profile routes
router.post("/api/v1/settings/companyprofile", handleOverLoad(AddCompanyInfoHandler));
router.get("/api/v1/settings/companyprofile", getCompanyInfoHandler);
router.post("/api/v1/settings/companyprofile/images", checkTokenExists, requireCompanyImageAdmin, handleUploadCompanyImage);
router.get("/api/v1/settings/companyprofile/images", getCompanyImageHandler);

export default router
