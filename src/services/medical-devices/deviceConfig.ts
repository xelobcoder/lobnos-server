export interface DeviceConfig {
    id: string;
    name: string;
    ip: string;
    port: number;
    type: 'MINDRAY_G20' | 'OTHER_DEVICE';
    version: string;
}

export const registeredDevices: DeviceConfig[] = [
    {
        id: 'MINDRAY_G20_01',
        name: 'Mindray G20 Analyzer',
        ip: '192.168.1.100',
        port: 6668,
        type: 'MINDRAY_G20',
        version: '2.5.1'
    },
    {
        id: 'OTHER_DEVICE_01',
        name: 'Other Device',
        ip: '192.168.1.101',
        port: 6668,
        type: 'OTHER_DEVICE',
        version: '2.3.1'
    }
];