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

// Department routes
router.get("/api/v1/departments", handleGetDepartments);
router.post("/api/v1/departments", handleAddNewDepartment);
router.put("/api/v1/departments", handleUpdateDepartment);
router.delete("/api/v1/departments", handleDeleteDepartment);
router.get('/api/v1/departments/:id', handleGetSpecificDepartment);

// Company profile routes
router.post("/api/v1/settings/companyprofile", AddCompanyInfoHandler);
router.get("/api/v1/settings/companyprofile", getCompanyInfoHandler);
router.post("/api/v1/settings/companyprofile/images", handleUploadCompanyImage);
router.get("/api/v1/settings/companyprofile/images", getCompanyImageHandler);

export default router