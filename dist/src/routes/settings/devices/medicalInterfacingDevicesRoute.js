"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hl7SoftwareProcessing_1 = require("../../../controllers/settings/devices/hl7SoftwareProcessing");
const medicalInterfacingDevicesController_1 = require("../../../controllers/settings/devices/medicalInterfacingDevicesController");
const helper_1 = require("../../../hooks/helper");
const express_1 = require("express");
const InterfacingDevicesRouterT = (0, express_1.Router)();
// All routes begin with /api/v1/interfacing/devices
InterfacingDevicesRouterT.get("/api/v1/interfacing/devices", medicalInterfacingDevicesController_1.getAllDevicesHandler);
InterfacingDevicesRouterT.get("/api/v1/interfacing/devices/:id", (0, helper_1.handleOverLoad)(medicalInterfacingDevicesController_1.getDeviceByIdHandler));
InterfacingDevicesRouterT.post("/api/v1/interfacing/devices", medicalInterfacingDevicesController_1.createDeviceHandler);
InterfacingDevicesRouterT.put("/api/v1/interfacing/devices/:id", medicalInterfacingDevicesController_1.updateDeviceHandler);
InterfacingDevicesRouterT.delete("/api/v1/interfacing/devices/:id", medicalInterfacingDevicesController_1.deleteDeviceHandler);
InterfacingDevicesRouterT.post('/api/v1/interfacing/devices/receiving/data', (0, helper_1.handleOverLoad)(hl7SoftwareProcessing_1.handleReceivedIntefacingData));
exports.default = InterfacingDevicesRouterT;
