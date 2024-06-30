import { Router } from "express";
import {
  handleGetDepartments,
  handleAddNewDepartment,
  handleDeleteDepartment,
  handleUpdateDepartment,
  handleGetSpecificDepartment,
} from "handlers";

const router = Router();

router.get("/api/v1/departments", handleGetDepartments);
router.post("/api/v1/departments", handleAddNewDepartment);
router.delete("/api/v1/departments", handleDeleteDepartment);
router.put("/api/v1/departments", handleUpdateDepartment);
// router.get('/api/v1/departments/:id', handleGetSpecificDepartment);

export default router;
