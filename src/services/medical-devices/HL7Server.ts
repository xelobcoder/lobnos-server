import path from 'path';
import net from 'net';
import { HL7Parser } from './HL7Parser';
import logger from '../../hooks/logger';
import { DeviceConfig, registeredDevices } from './deviceConfig';

class DeviceConnection {
    public readonly id: string;
    public readonly ip: string;
    public readonly port: number;
    public readonly socket: net.Socket;
    public parser: HL7Parser;
    public storagePath: string;
    private config: DeviceConfig | undefined;

    constructor(socket: net.Socket) {
        this.socket = socket;
        this.ip = this.normalizeIP(socket.remoteAddress || 'unknown');
        this.port = socket.remotePort || 0;
        this.id = `${this.ip}_${this.port}`;
        this.parser = new HL7Parser();
        this.storagePath = path.join(__dirname, '../../../data/hl7_messages', this.id);
        this.config = this.findDeviceConfig();
    }

    private normalizeIP(ip: string): string {
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

    private findDeviceConfig(): DeviceConfig | undefined {
        return registeredDevices.find(device => device.ip === this.ip);
    }

    initializeDeviceSpecificSettings() {
        if (!this.config) {
            logger.warn(`Unknown device connected from ${this.ip}`);
            return;
        }

        this.parser = new HL7Parser();
        this.storagePath = path.join(
            __dirname, 
            '../../../data/hl7_messages', 
            this.config.type.toLowerCase(),
            this.config.id
        );
        
        logger.info(`Initialized ${this.config.name} (${this.config.id})`);
    }

    saveData(data: Buffer) {
        const fs = require('fs');
        try {
            // Create base directory if it doesn't exist
            const baseDir = path.join(__dirname, '../../../data/hl7_messages');
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }
            
            // Create device-specific directory
            if (!fs.existsSync(this.storagePath)) {
                fs.mkdirSync(this.storagePath, { recursive: true });
            }
            
            const fileName = 'latest_message.dat';
            const filePath = path.join(this.storagePath, fileName);
            fs.writeFileSync(filePath, data);
            
            if (this.config) {
                logger.info(`Updated data from ${this.config.name} (${this.config.id})`);
            }
        } catch (error) {
            logger.error(`Failed to save data for device ${this.id}:`, error);
        }
    }
}

export class HL7Server {
    private server: net.Server;
    private port: number;
    private activeConnections: Map<string, DeviceConnection>;

    constructor(port: number = 6668) {
        this.port = port;
        this.server = net.createServer(this.handleConnection.bind(this));
        this.activeConnections = new Map();
    }

    private handleConnection(socket: net.Socket) {
        const device = new DeviceConnection(socket);
        device.initializeDeviceSpecificSettings();
        this.activeConnections.set(device.id, device);

        console.log(`New connection from ${device.id}`);
        logger.info(`New device connected from ${device.id}`);

        socket.on('data', (data) => {
            try {
                device.saveData(data as Buffer);
                const messageString = data.toString('utf8');
                const message = device.parser.parse(messageString);
                this.processMessage(message, device);
            } catch (error) {
                logger.error(`Error processing message from ${device.id}:`, error);
                socket.write(device.parser.createNAK());
            }
        });

        socket.on('close', () => {
            this.activeConnections.delete(device.id);
            console.log(`Connection closed: ${device.id}`);
            logger.info(`Device disconnected: ${device.id}`);
        });

        socket.on('error', (error) => {
            logger.error(`Socket error from ${device.id}:`, error);
        });
    }

    private processMessage(message: any, device: DeviceConnection) {
        try {
            switch (message.type) {
                case 'ORU':
                    this.handleResults(message, device);
                    break;
                case 'ADT':
                    this.handleAdmission(message, device);
                    break;
                default:
                    logger.warn(`Unsupported message type from ${device.id}: ${message.type}`);
            }
            device.socket.write(device.parser.createACK(message));
        } catch (error) {
            logger.error(`Message processing error from ${device.id}:`, error);
            device.socket.write(device.parser.createNAK());
        }
    }

    private handleResults(message: any, device: DeviceConnection) {
        try {
            if (message.type === 'ORU' && message.segments) {
                const segments = message.segments;
                console.log('Raw Segments:', segments); 

                // Extract segments from the array format
                const msh = segments.find((seg: string[]) => seg[0] === 'MSH');
                const pid = segments.find((seg: string[]) => seg[0] === 'PID');
                const orc = segments.find((seg: string[]) => seg[0] === 'ORC');
                const obr = segments.find((seg: string[]) => seg[0] === 'OBR');
                const obxSegments = segments.filter((seg: string[]) => seg[0] === 'OBX');

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
                obxSegments.forEach((obx: string[]) => {
                    if (obx && obx.length >= 14) {
                        const testCode = (obx[3] || '').split('^')[0];
                        const testName = (obx[3] || '').split('^')[1];
                        
                        if (testName) {
                            result.results[testName]  = {
                                code: testCode,
                                value: parseFloat(obx[5] || '0'),
                                unit: obx[6] || '',
                                referenceRange: obx[7] || '',
                                flag: obx[8] || '',
                                observationDateTime: obx[14] || ''
                            } as any; 
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
        } catch (error) {
            console.error('Error details:', error);
            logger.error('Error processing CBC results:', error);
        }
    }

    private parseName(nameString: string): any {
        const parts = nameString.split('^');
        return {
            full: parts.join(' '),
            family: parts[0] || '',
            given: parts[1] || '',
            middle: parts[2] || '',
            title: parts[3] || ''
        };
    }

    private parseAddress(addressString: string): any {
        const parts = addressString.split('^');
        return {
            street: parts[0] || '',
            city: parts[2] || '',
            country: parts[4] || '',
            countryCode: parts[5] || ''
        };
    }

    private parseProvider(providerString: string): any {
        const parts = providerString.split('^');
        return {
            id: parts[0] || '',
            family: parts[1] || '',
            given: parts[2] || '',
            middle: parts[3] || '',
            title: parts[5] || ''
        };
    }

    private handleAdmission(_message: any, _device: DeviceConnection) {
       
    }

    start() {
        this.server.listen(this.port, () => {
            console.log('=================================');
            console.log(`HL7 Server started on port ${this.port}`);
            console.log('=================================');
            logger.info(`HL7 Server listening on port ${this.port}`);
        });
    }
}