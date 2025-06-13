"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const departmenthandlers_1 = require("./handlers/departmenthandlers");
const companyhandler_1 = require("./handlers/companyhandler");
// Department routes
router.get("/api/v1/departments", departmenthandlers_1.handleGetDepartments);
router.post("/api/v1/departments", departmenthandlers_1.handleAddNewDepartment);
router.put("/api/v1/departments", departmenthandlers_1.handleUpdateDepartment);
router.delete("/api/v1/departments", departmenthandlers_1.handleDeleteDepartment);
router.get('/api/v1/departments/:id', departmenthandlers_1.handleGetSpecificDepartment);
// Company profile routes
router.post("/api/v1/settings/companyprofile", companyhandler_1.AddCompanyInfoHandler);
router.get("/api/v1/settings/companyprofile", companyhandler_1.getCompanyInfoHandler);
router.post("/api/v1/settings/companyprofile/images", companyhandler_1.handleUploadCompanyImage);
router.get("/api/v1/settings/companyprofile/images", companyhandler_1.getCompanyImageHandler);
exports.default = router;
