import { handleReceivedIntefacingData, handleReceivedIntefacingDataProcessor,  } from "../../../controllers/settings/devices/hl7SoftwareProcessing";
import { getAllDevicesHandler, getDeviceByIdHandler, createDeviceHandler, updateDeviceHandler, deleteDeviceHandler } from "../../../controllers/settings/devices/medicalInterfacingDevicesController";
import { handleOverLoad } from "../../../hooks/helper";
import { Router } from "express";
import { PrimeWindowAccessController } from "../../../controllers/settings/PrimeWindowAccessController";
import { getDeviceManagerSessionHandler } from "../../../controllers/settings/devices/deviceManagerSessionController";
import { deviceManagerLicenseGate } from "../../../controllers/settings/devices/deviceManagerLicenseGate";

const InterfacingDevicesRouterT = Router();

// All routes begin with /api/v1/interfacing/devices
InterfacingDevicesRouterT.get("/api/v1/interfacing/devices", deviceManagerLicenseGate, getAllDevicesHandler);
InterfacingDevicesRouterT.get("/api/v1/interfacing/devices/license", handleOverLoad(PrimeWindowAccessController.checkLicense));
InterfacingDevicesRouterT.get("/api/v1/interfacing/devices/session", getDeviceManagerSessionHandler);
InterfacingDevicesRouterT.get("/api/v1/interfacing/devices/:id", handleOverLoad(getDeviceByIdHandler));
InterfacingDevicesRouterT.post("/api/v1/interfacing/devices", createDeviceHandler);
InterfacingDevicesRouterT.put("/api/v1/interfacing/devices/:id", updateDeviceHandler);
InterfacingDevicesRouterT.delete("/api/v1/interfacing/devices/:id", deleteDeviceHandler);
InterfacingDevicesRouterT.post('/api/v1/interfacing/devices/receiving/data', deviceManagerLicenseGate, handleOverLoad(handleReceivedIntefacingDataProcessor));
export default InterfacingDevicesRouterT;
