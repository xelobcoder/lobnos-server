import KnexConnection from "../../../database/KnexConnections";
import logger from "../../../hooks/logger";

export interface IMedicalInterfacingDevice {
     id?: number;
     name?: string;
     ip?: string;
     dial_port?: string;
     listen_port?: string;
     connection_mode?: 'pull' | 'feed' | 'hybrid' | 'server';
     use_tls?: number;
     active?: number;
     created_at?: string;
     testid?: number[];
     last_known_ip?: string;
     last_connected?: string;
     device_info?: string;
}

export default class MedicalInterfacingDevicesRepository {
     private connection;
     private tablename: string = 'medicalinterfacingdevices';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async createDevice(device: IMedicalInterfacingDevice): Promise<number> {
          try {
               const connection = await this.connection;
               const result = await connection(this.tablename).insert(device).returning('id');
               return result[0];
          } catch (error:any) {
               throw new Error('Failed to create device: ' + error.message);
          }
     }

     async getDeviceById(id: number): Promise<IMedicalInterfacingDevice | undefined> {
          const connection = await this.connection;
          const record = await connection(this.tablename).where({ id }).first();
          if (record) {
               if (typeof record.testid === 'string') {
                    if (record.testid.trim() === '') {
                         record.testid = [];
                    } else if (record.testid.includes(',')) {
                         record.testid = record.testid.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
                    } else {
                         const n = parseInt(record.testid.trim(), 10);
                         record.testid = isNaN(n) ? [] : [n];
                    }
               } else if (record.testid == null) {
                    record.testid = [];
               }
          }
          return record;
     }

     async updateDevice(id: number, device: Partial<IMedicalInterfacingDevice>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tablename).where({ id }).update(device);
     }

     async deleteDevice(id: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tablename).where({ id }).del();
     }

     async getAllDevices(): Promise<IMedicalInterfacingDevice[]> {
          const connection = await this.connection;
          const records = await connection(this.tablename).select('*');
          return records.map((rec: any) => {
               if (rec) {
                    if (typeof rec.testid === 'string') {
                         if (rec.testid.trim() === '') {
                              rec.testid = [];
                         } else if (rec.testid.includes(',')) {
                              rec.testid = rec.testid.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
                         } else {
                              const n = parseInt(rec.testid.trim(), 10);
                              rec.testid = isNaN(n) ? [] : [n];
                         }
                    } else if (rec.testid == null) {
                         rec.testid = [];
                    }
               }
               return rec;
          });
     }

     async getActiveDevices(): Promise<IMedicalInterfacingDevice[]> {
          const connection = await this.connection;
          const records = await connection(this.tablename).where({ active: 1 }).select('*');
          return records.map((rec: any) => {
               if (rec) {
                    if (typeof rec.testid === 'string') {
                         if (rec.testid.trim() === '') {
                              rec.testid = [];
                         } else if (rec.testid.includes(',')) {
                              rec.testid = rec.testid.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
                         } else {
                              const n = parseInt(rec.testid.trim(), 10);
                              rec.testid = isNaN(n) ? [] : [n];
                         }
                    } else if (rec.testid == null) {
                         rec.testid = [];
                    }
               }
               return rec;
          });
     }

     async findByIP(ip: string): Promise<IMedicalInterfacingDevice | undefined> {
          const connection = await this.connection;
          const record = await connection(this.tablename).where({ ip }).first();
          if (record) {
               if (typeof record.testid === 'string') {
                    if (record.testid.trim() === '') {
                         record.testid = [];
                    } else if (record.testid.includes(',')) {
                         record.testid = record.testid.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
                    } else {
                         const n = parseInt(record.testid.trim(), 10);
                         record.testid = isNaN(n) ? [] : [n];
                    }
               } else if (record.testid == null) {
                    record.testid = [];
               }
          }
          return record;
     }
}
