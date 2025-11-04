import KnexConnection from "../../../database/KnexConnections";


interface AccessRequest {
     id?: number;
     patientid: number;
     staffid: number;
     requestType: 'access' | 'edit';
     requestedAt: Date;
     status: 'pending' | 'granted' | 'revoked' | 'expired';
     ascensionid: number;
     grantedAt?: Date;
     revokedAt?: Date;
     expiredAt?: Date;
     accessedAt?: Date;
     reason?: string;
     urgency?: 'low' | 'medium' | 'high' | 'critical';
}

export default class ResultAccessTableRepo {
     private static readonly TABLE_NAME = 'result_access_requests';

     static async create(tenantId: number, request: Omit<AccessRequest, 'id' | 'requestedAt'>): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const [id] = await connection(this.TABLE_NAME).insert({
               ...request,
               requestedAt: new Date(),
               status: 'pending'
          });
          return id;
     }

     static async findById(tenantId: number, id: number): Promise<AccessRequest | undefined> {
          const connection = await KnexConnection(tenantId);
          return await connection(this.TABLE_NAME).where({ id }).first();
     }

     static async findByPatientId(tenantId: number, patientid: number): Promise<AccessRequest[]> {
          const connection = await KnexConnection(tenantId);
          return await connection(this.TABLE_NAME).where({ patientid });
     }

     static async findByStaffId(tenantId: number, staffid: number): Promise<AccessRequest[]> {
          const connection = await KnexConnection(tenantId);
          return await connection(this.TABLE_NAME).where({ staffid });
     }

     static async findByAscensionId(tenantId: number, ascensionid: number): Promise<AccessRequest[]> {
          const connection = await KnexConnection(tenantId);
          return await connection(this.TABLE_NAME).where({ ascensionid });
     }

     static async findLatestByAscensionAndStaff(tenantId: number, ascensionid: number, staffid: number): Promise<AccessRequest | undefined> {
          const connection = await KnexConnection(tenantId);
          return await connection(this.TABLE_NAME)
               .where({ ascensionid, staffid })
               .orderBy('requestedAt', 'desc')
               .first();
     }

     static async findAll(tenantId: number, query?: { page?: number, count?: number, status?: string }): Promise<AccessRequest[]> {
          const { page = 1, count = 20, status } = query || {};
          const connection = await KnexConnection(tenantId);
          let q = connection(this.TABLE_NAME).select('*');
          if (status) q = q.where({ status });
          return await q.limit(count).offset((page - 1) * count);
     }

     static async update(tenantId: number, id: number, updates: Partial<AccessRequest>): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.TABLE_NAME).where({ id }).update(updates);
          return updated > 0;
     }

     static async delete(tenantId: number, id: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const deleted = await connection(this.TABLE_NAME).where({ id }).del();
          return deleted > 0;
     }


     static async grantAccess(tenantId: number, requestId: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ status: 'granted', grantedAt: new Date() });
          return updated > 0;
     }

     static async revokeAccess(tenantId: number, requestId: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ status: 'revoked', revokedAt: new Date() });
          return updated > 0;
     }

     static async expireAccess(tenantId: number, requestId: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ status: 'expired', expiredAt: new Date() });
          return updated > 0;
     }

     static async markAccessUsed(tenantId: number, requestId: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ accessedAt: new Date() });
          return updated > 0;
     }
}
