"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const medicalInterfacingDevicesController_1 = require("../../../controllers/settings/devices/medicalInterfacingDevicesController");
const helper_1 = require("../../../hooks/helper");
const InterfacingDevicesRouter = express_1.default.Router();
// All routes begin with /api/v1/interfacing/devices
InterfacingDevicesRouter.get("/api/v1/interfacing/devices", medicalInterfacingDevicesController_1.getAllDevicesHandler);
InterfacingDevicesRouter.get("/api/v1/interfacing/devices/:id", (0, helper_1.handleOverLoad)(medicalInterfacingDevicesController_1.getDeviceByIdHandler));
InterfacingDevicesRouter.post("/api/v1/interfacing/devices", medicalInterfacingDevicesController_1.createDeviceHandler);
InterfacingDevicesRouter.put("/api/v1/interfacing/devices/:id", medicalInterfacingDevicesController_1.updateDeviceHandler);
InterfacingDevicesRouter.delete("/api/v1/interfacing/devices/:id", medicalInterfacingDevicesController_1.deleteDeviceHandler);
InterfacingDevicesRouter.post('/api/v1/interfacing/devices/receiving/data', (0, helper_1.handleOverLoad)(medicalInterfacingDevicesController_1.handleReceivedIntefacingData));
exports.default = InterfacingDevicesRouter;
