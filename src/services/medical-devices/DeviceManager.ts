import logger from '../../hooks/logger';
import { HL7Server } from './HL7Server';
import { DeviceConfig, registeredDevices } from './deviceConfig';

export class DeviceManager {
    private hl7Server: HL7Server;
    private devices: Map<string, DeviceConfig & { status: string; lastConnection: Date }>;

    constructor() {
        this.devices = new Map();
        registeredDevices.forEach(device => {
            this.registerDevice(device.id, device);
        });
    }

    initialize() {
        try {
            this.hl7Server = new HL7Server(6668);
            this.hl7Server.start();
            logger.info(`Device Manager initialized with ${this.devices.size} registered devices`);
        } catch (error) {
            logger.error('Failed to initialize Device Manager:', error);
            throw error;
        }
    }

    registerDevice(deviceId: string, config: DeviceConfig) {
        this.devices.set(deviceId, {
            ...config,
            status: 'offline',
            lastConnection: new Date()
        });
        logger.info(`Device registered: ${config.name} (${deviceId})`);
    }

    getDeviceStatus(deviceId: string) {
        return this.devices.get(deviceId);
    }

    getAllDevices() {
        return Array.from(this.devices.values());
    }

    updateDeviceStatus(deviceId: string, status: 'online' | 'offline') {
        const device = this.devices.get(deviceId);
        if (device) {
            device.status = status;
            device.lastConnection = new Date();
            logger.info(`Device ${device.name} (${deviceId}) is now ${status}`);
        }
    }
}