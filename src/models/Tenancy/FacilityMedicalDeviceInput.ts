import { isIP } from 'node:net';
import { FacilityError } from './FacilityInput';

export function parseMedicalDeviceId(value: unknown): number {
     if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value)) throw new FacilityError('Device ID must be a positive integer');
     return Number(value);
}

export function validateMedicalDeviceInput(input: unknown) {
     if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FacilityError('Device configuration is required');
     const body = input as Record<string, unknown>;
     const fields = ['id', 'name', 'ip', 'dial_port', 'listen_port', 'connection_mode', 'use_tls', 'active', 'testid', 'last_known_ip', 'device_info'];
     if (Object.keys(body).some(key => !fields.includes(key))) throw new FacilityError('Unsupported device configuration field');
     const text = (key: string, required = false, limit = 255) => {
          const value = body[key] ?? '';
          if (typeof value !== 'string' || value.length > limit || value.includes('\0') || (required && !value.trim())) {
               throw new FacilityError(`Invalid device ${key}`);
          }
          return value.trim();
     };
     const ip = text('ip', true);
     const lastKnownIp = text('last_known_ip');
     if (!isIP(ip) || (lastKnownIp && !isIP(lastKnownIp))) throw new FacilityError('Enter a valid device IP address');
     const port = (key: string, required = false) => {
          const value = text(key, required);
          if (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) {
               throw new FacilityError(`${key} must be between 1 and 65535`);
          }
          return value;
     };
     const flag = (key: string) => {
          const value = body[key];
          if (value !== 0 && value !== 1 && value !== false && value !== true) throw new FacilityError(`Invalid device ${key}`);
          return Number(value);
     };
     const mode = text('connection_mode', true);
     if (!['pull', 'feed', 'hybrid', 'server'].includes(mode)) throw new FacilityError('Invalid device connection mode');
     const testIds = body.testid ?? '';
     const ids = Array.isArray(testIds) ? testIds : typeof testIds === 'string' ? testIds.trim() ? testIds.split(',').map(value => value.trim()) : [] : null;
     if (!ids || ids.length > 100 || ids.some(id => !/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id)))) {
          throw new FacilityError('Test IDs must be comma-separated positive integers');
     }
     return {
          name: text('name', true), ip, dial_port: port('dial_port', true), listen_port: port('listen_port'),
          connection_mode: mode, use_tls: flag('use_tls'), active: flag('active'),
          testid: [...new Set(ids.map(Number))].join(','), last_known_ip: lastKnownIp, device_info: text('device_info', false, 4096),
     };
}

export type MedicalDeviceConfiguration = ReturnType<typeof validateMedicalDeviceInput>;
