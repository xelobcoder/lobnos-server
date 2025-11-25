import { Router } from "express";
import commissionRoutes from "./routes";

const router = Router();

// Commission Payments Routes
router.use("/api/v1/commission-payments", commissionRoutes);

export default router;