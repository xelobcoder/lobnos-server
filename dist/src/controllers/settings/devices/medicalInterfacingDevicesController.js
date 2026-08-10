"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDevicesHandler = getAllDevicesHandler;
exports.getDeviceByIdHandler = getDeviceByIdHandler;
exports.createDeviceHandler = createDeviceHandler;
exports.updateDeviceHandler = updateDeviceHandler;
exports.deleteDeviceHandler = deleteDeviceHandler;
const MedicalInterfacingDevicesRepository_1 = __importDefault(require("../../../models/settings/devices/MedicalInterfacingDevicesRepository"));
async function getAllDevicesHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = new MedicalInterfacingDevicesRepository_1.default(tenantId);
        const devices = await repo.getAllDevices();
        res.json(devices);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function getDeviceByIdHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = new MedicalInterfacingDevicesRepository_1.default(tenantId);
        const device = await repo.getDeviceById(Number(req.params.id));
        if (!device)
            return res.status(404).json({ error: "Device not found" });
        res.json(device);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function createDeviceHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = new MedicalInterfacingDevicesRepository_1.default(tenantId);
        const id = await repo.createDevice(req.body);
        res.status(201).json({ id, status: parseInt(id.toString()) > 0 ? 'success' : 'failed' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function updateDeviceHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = new MedicalInterfacingDevicesRepository_1.default(tenantId);
        const updated = await repo.updateDevice(Number(req.params.id), req.body);
        res.json({ updated, status: parseInt(updated.toString()) > 0 ? 'success' : 'failed' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function deleteDeviceHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = new MedicalInterfacingDevicesRepository_1.default(tenantId);
        const deleted = await repo.deleteDevice(Number(req.params.id));
        res.json({ deleted, status: parseInt(deleted.toString()) > 0 ? 'success' : 'failed' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
