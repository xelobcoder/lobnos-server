import express from "express";
import {
     getAllDevicesHandler,
     getDeviceByIdHandler,
     createDeviceHandler,
     updateDeviceHandler,
     deleteDeviceHandler,
     handleReceivedIntefacingData
} from "../../../controllers/settings/devices/medicalInterfacingDevicesController";
import { handleOverLoad } from "../../../hooks/helper";

const InterfacingDevicesRouter = express.Router();

// All routes begin with /api/v1/interfacing/devices
InterfacingDevicesRouter.get("/api/v1/interfacing/devices", getAllDevicesHandler);
InterfacingDevicesRouter.get("/api/v1/interfacing/devices/:id", handleOverLoad(getDeviceByIdHandler));
InterfacingDevicesRouter.post("/api/v1/interfacing/devices", createDeviceHandler);
InterfacingDevicesRouter.put("/api/v1/interfacing/devices/:id", updateDeviceHandler);
InterfacingDevicesRouter.delete("/api/v1/interfacing/devices/:id", deleteDeviceHandler);
InterfacingDevicesRouter.post('/api/v1/interfacing/devices/receiving/data', handleOverLoad(handleReceivedIntefacingData));
export default InterfacingDevicesRouter;
