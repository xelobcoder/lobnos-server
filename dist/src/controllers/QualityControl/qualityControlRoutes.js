"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const DeviceController_1 = require("./DeviceController");
const ControlMaterialController_1 = require("./ControlMaterialController");
const ControlParameterController_1 = require("./ControlParameterController");
const QCReadingsController_1 = require("./QCReadingsController");
const router = express_1.default.Router();
const deviceController = new DeviceController_1.DeviceController();
const controlMaterialController = new ControlMaterialController_1.ControlMaterialController();
const controlParameterController = new ControlParameterController_1.ControlParameterController();
const qcReadingsController = new QCReadingsController_1.QCReadingsController();
// Device Routes
router.post('/api/v1/devices', deviceController.create.bind(deviceController));
router.put('/api/v1/devices/:id', deviceController.update.bind(deviceController));
router.get('/api/v1/devices/:id', deviceController.getById.bind(deviceController));
router.get('/api/v1/devices/status/:status', deviceController.getByStatus.bind(deviceController));
router.get('/api/v1/devices/calibration-due/:date', deviceController.getByCalibrationDue.bind(deviceController));
router.get('/api/v1/devices/search/devices', deviceController.searchByName.bind(deviceController));
router.get('/api/v1/devices', deviceController.getPaginated.bind(deviceController));
router.delete('/api/v1/devices/:id', deviceController.delete.bind(deviceController));
// Control Material Routes
router.get('/api/v1/controlmaterials/search', controlMaterialController.searchByName.bind(controlMaterialController));
router.post('/api/v1/controlmaterials', controlMaterialController.create.bind(controlMaterialController));
router.put('/api/v1/controlmaterials/:id', controlMaterialController.update.bind(controlMaterialController));
router.get('/api/v1/controlmaterials/:id', controlMaterialController.getById.bind(controlMaterialController));
router.get('/api/v1/controlmaterials/status/:status', controlMaterialController.getByStatus.bind(controlMaterialController));
router.get('/api/v1/controlmaterials/expiry/:date', controlMaterialController.getByExpiryDate.bind(controlMaterialController));
router.get('/api/v1/controlmaterials/device/:deviceId', controlMaterialController.getByDeviceId.bind(controlMaterialController));
router.get('/api/v1/controlmaterials', controlMaterialController.getPaginated.bind(controlMaterialController));
router.delete('/api/v1/controlmaterials/:id', controlMaterialController.delete.bind(controlMaterialController));
router.get('/api/v1/controlmaterials/test/associated/:testId', controlMaterialController.getByTestId.bind(controlMaterialController));
// Control Parameter Routes
router.post('/api/v1/controlparameters/bulk', controlParameterController.create.bind(controlParameterController));
router.put('/api/v1/controlparameters/material/:controlId', controlParameterController.update.bind(controlParameterController));
router.get('/api/v1/controlparameters/:id', controlParameterController.getById.bind(controlParameterController));
router.get('/api/v1/controlparameters/material/:controlId', controlParameterController.getByMaterialId.bind(controlParameterController));
router.get('/api/v1/controlparameters/search', controlParameterController.search.bind(controlParameterController));
router.get('/api/v1/controlparameters', controlParameterController.getAll.bind(controlParameterController));
router.delete('/api/v1/controlparameters/:id', controlParameterController.delete.bind(controlParameterController));
// QC Sessions Routes
router.post('/api/v1/qc-sessions', qcReadingsController.createSession.bind(qcReadingsController));
router.get('/api/v1/qc-sessions/:id', qcReadingsController.getSessionById.bind(qcReadingsController));
router.put('/api/v1/qc-sessions/:id', qcReadingsController.updateSession.bind(qcReadingsController));
router.delete('/api/v1/qc-sessions/:id', qcReadingsController.deleteSession.bind(qcReadingsController));
router.get('/api/v1/qc-sessions', qcReadingsController.getSessionsPaginated.bind(qcReadingsController));
// QC Readings Routes
router.post('/api/v1/qc-readings', qcReadingsController.create.bind(qcReadingsController));
router.post('/api/v1/qc-readings/batch', qcReadingsController.addReadingsToSession.bind(qcReadingsController));
router.put('/api/v1/qc-readings/:id', qcReadingsController.update.bind(qcReadingsController));
router.delete('/api/v1/qc-readings/session/:sessionId', qcReadingsController.deleteBySessionId.bind(qcReadingsController));
router.get('/api/v1/qc-readings/:id', qcReadingsController.getById.bind(qcReadingsController));
router.get('/api/v1/qc-readings/session/:sessionId/:control', qcReadingsController.getBySessionAndControlId.bind(qcReadingsController));
router.get('/api/v1/qc-readings/session/:sessionId', qcReadingsController.getBySessionId.bind(qcReadingsController));
router.get('/api/v1/qc-readings/status', qcReadingsController.getByStatus.bind(qcReadingsController));
router.get('/api/v1/qc-readings', qcReadingsController.getPaginated.bind(qcReadingsController));
router.get('/api/v1/qc-readings/session/summary/:sessionId/batches', qcReadingsController.getBatchesBySessionId.bind(qcReadingsController));
exports.default = router;
