import { Router } from "express";
import commissionRoutes from "./routes";
import { isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";

const router = Router();
router.use("/api/v1/commission-payments", commissionRoutes);

export default router;