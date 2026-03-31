"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HL7Server = void 0;
const path_1 = __importDefault(require("path"));
const net_1 = __importDefault(require("net"));
const HL7Parser_1 = require("./HL7Parser");
const logger_1 = __importDefault(require("../../hooks/logger"));
const deviceConfig_1 = require("./deviceConfig");
class DeviceConnection {
    constructor(socket) {
        this.socket = socket;
        this.ip = this.normalizeIP(socket.remoteAddress || 'unknown');
        this.port = socket.remotePort || 0;
        this.id = `${this.ip}_${this.port}`;
        this.parser = new HL7Parser_1.HL7Parser();
        this.storagePath = path_1.default.join(__dirname, '../../../data/hl7_messages', this.id);
        this.config = this.findDeviceConfig();
    }
    normalizeIP(ip) {
        // Convert IPv6 localhost to IPv4 format
        if (ip === '::1') {
            return '127.0.0.1';
        }
        // Remove IPv6 prefix if present
        if (ip.includes('::ffff:')) {
            return ip.replace('::ffff:', '');
        }
        return ip;
    }
    findDeviceConfig() {
        return deviceConfig_1.registeredDevices.find(device => device.ip === this.ip);
    }
    initializeDeviceSpecificSettings() {
        if (!this.config) {
            logger_1.default.warn(`Unknown device connected from ${this.ip}`);
            return;
        }
        this.parser = new HL7Parser_1.HL7Parser();
        this.storagePath = path_1.default.join(__dirname, '../../../data/hl7_messages', this.config.type.toLowerCase(), this.config.id);
        logger_1.default.info(`Initialized ${this.config.name} (${this.config.id})`);
    }
    saveData(data) {
        const fs = require('fs');
        try {
            // Create base directory if it doesn't exist
            const baseDir = path_1.default.join(__dirname, '../../../data/hl7_messages');
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }
            // Create device-specific directory
            if (!fs.existsSync(this.storagePath)) {
                fs.mkdirSync(this.storagePath, { recursive: true });
            }
            const fileName = 'latest_message.dat';
            const filePath = path_1.default.join(this.storagePath, fileName);
            fs.writeFileSync(filePath, data);
            if (this.config) {
                logger_1.default.info(`Updated data from ${this.config.name} (${this.config.id})`);
            }
        }
        catch (error) {
            logger_1.default.error(`Failed to save data for device ${this.id}:`, error);
        }
    }
}
class HL7Server {
    constructor(port = 6668) {
        this.port = port;
        this.server = net_1.default.createServer(this.handleConnection.bind(this));
        this.activeConnections = new Map();
    }
    handleConnection(socket) {
        const device = new DeviceConnection(socket);
        device.initializeDeviceSpecificSettings();
        this.activeConnections.set(device.id, device);
        console.log(`New connection from ${device.id}`);
        logger_1.default.info(`New device connected from ${device.id}`);
        socket.on('data', (data) => {
            try {
                device.saveData(data);
                const messageString = data.toString('utf8');
                const message = device.parser.parse(messageString);
                this.processMessage(message, device);
            }
            catch (error) {
                logger_1.default.error(`Error processing message from ${device.id}:`, error);
                socket.write(device.parser.createNAK());
            }
        });
        socket.on('close', () => {
            this.activeConnections.delete(device.id);
            console.log(`Connection closed: ${device.id}`);
            logger_1.default.info(`Device disconnected: ${device.id}`);
        });
        socket.on('error', (error) => {
            logger_1.default.error(`Socket error from ${device.id}:`, error);
        });
    }
    processMessage(message, device) {
        try {
            switch (message.type) {
                case 'ORU':
                    this.handleResults(message, device);
                    break;
                case 'ADT':
                    this.handleAdmission(message, device);
                    break;
                default:
                    logger_1.default.warn(`Unsupported message type from ${device.id}: ${message.type}`);
            }
            device.socket.write(device.parser.createACK(message));
        }
        catch (error) {
            logger_1.default.error(`Message processing error from ${device.id}:`, error);
            device.socket.write(device.parser.createNAK());
        }
    }
    handleResults(message, device) {
        try {
            if (message.type === 'ORU' && message.segments) {
                const segments = message.segments;
                console.log('Raw Segments:', segments);
                // Extract segments from the array format
                const msh = segments.find((seg) => seg[0] === 'MSH');
                const pid = segments.find((seg) => seg[0] === 'PID');
                const orc = segments.find((seg) => seg[0] === 'ORC');
                const obr = segments.find((seg) => seg[0] === 'OBR');
                const obxSegments = segments.filter((seg) => seg[0] === 'OBX');
                if (!msh || !pid || !orc || !obr || !obxSegments.length) {
                    throw new Error('Missing required segments');
                }
                const result = {
                    messageInfo: {
                        sendingApp: msh[2] || '',
                        sendingFacility: msh[3] || '',
                        receivingApp: msh[4] || '',
                        receivingFacility: msh[5] || '',
                        timestamp: msh[6] || '',
                        messageType: msh[8] || '',
                        messageId: msh[9] || ''
                    },
                    patient: {
                        id: pid[3] || '',
                        name: this.parseName(pid[5] || ''),
                        dateOfBirth: pid[7] || '',
                        gender: pid[8] || '',
                        address: this.parseAddress(pid[11] || ''),
                        phone: pid[13] || ''
                    },
                    order: {
                        id: orc[2] || '',
                        placerOrderId: orc[3] || '',
                        orderingProvider: this.parseProvider(orc[10] || ''),
                        orderDateTime: orc[9] || ''
                    },
                    testInfo: {
                        testId: obr[3] || '',
                        testName: (obr[4] || '').split('^')[1] || '',
                        collectionDateTime: obr[6] || '',
                        resultDateTime: obr[7] || ''
                    },
                    results: {}
                };
                // Process OBX segments
                obxSegments.forEach((obx) => {
                    if (obx && obx.length >= 14) {
                        const testCode = (obx[3] || '').split('^')[0];
                        const testName = (obx[3] || '').split('^')[1];
                        if (testName) {
                            result.results[testName] = {
                                code: testCode,
                                value: parseFloat(obx[5] || '0'),
                                unit: obx[6] || '',
                                referenceRange: obx[7] || '',
                                flag: obx[8] || '',
                                observationDateTime: obx[14] || ''
                            };
                        }
                    }
                });
                console.log('=================================');
                console.log('Parsed HL7 Message:');
                console.log('=================================');
                console.log(JSON.stringify(result, null, 2));
                console.log('=================================');
                return result;
            }
        }
        catch (error) {
            console.error('Error details:', error);
            logger_1.default.error('Error processing CBC results:', error);
        }
    }
    parseName(nameString) {
        const parts = nameString.split('^');
        return {
            full: parts.join(' '),
            family: parts[0] || '',
            given: parts[1] || '',
            middle: parts[2] || '',
            title: parts[3] || ''
        };
    }
    parseAddress(addressString) {
        const parts = addressString.split('^');
        return {
            street: parts[0] || '',
            city: parts[2] || '',
            country: parts[4] || '',
            countryCode: parts[5] || ''
        };
    }
    parseProvider(providerString) {
        const parts = providerString.split('^');
        return {
            id: parts[0] || '',
            family: parts[1] || '',
            given: parts[2] || '',
            middle: parts[3] || '',
            title: parts[5] || ''
        };
    }
    handleAdmission(_message, _device) {
    }
    start() {
        this.server.listen(this.port, () => {
            console.log('=================================');
            console.log(`HL7 Server started on port ${this.port}`);
            console.log('=================================');
            logger_1.default.info(`HL7 Server listening on port ${this.port}`);
        });
    }
}
exports.HL7Server = HL7Server;
