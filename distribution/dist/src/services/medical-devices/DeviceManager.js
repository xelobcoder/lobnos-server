"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceManager = void 0;
const logger_1 = __importDefault(require("../../hooks/logger"));
const HL7Server_1 = require("./HL7Server");
const deviceConfig_1 = require("./deviceConfig");
class DeviceManager {
    constructor() {
        this.devices = new Map();
        deviceConfig_1.registeredDevices.forEach(device => {
            this.registerDevice(device.id, device);
        });
    }
    initialize() {
        try {
            this.hl7Server = new HL7Server_1.HL7Server(6668);
            this.hl7Server.start();
            logger_1.default.info(`Device Manager initialized with ${this.devices.size} registered devices`);
        }
        catch (error) {
            logger_1.default.error('Failed to initialize Device Manager:', error);
            throw error;
        }
    }
    registerDevice(deviceId, config) {
        this.devices.set(deviceId, Object.assign(Object.assign({}, config), { status: 'offline', lastConnection: new Date() }));
        logger_1.default.info(`Device registered: ${config.name} (${deviceId})`);
    }
    getDeviceStatus(deviceId) {
        return this.devices.get(deviceId);
    }
    getAllDevices() {
        return Array.from(this.devices.values());
    }
    updateDeviceStatus(deviceId, status) {
        const device = this.devices.get(deviceId);
        if (device) {
            device.status = status;
            device.lastConnection = new Date();
            logger_1.default.info(`Device ${device.name} (${deviceId}) is now ${status}`);
        }
    }
}
exports.DeviceManager = DeviceManager;
