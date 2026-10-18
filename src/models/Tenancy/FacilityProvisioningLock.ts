import { Connection, RowDataPacket } from 'mysql2/promise';
import { FacilityError } from './FacilityInput';

const lockName = (tenantId: number) => `pls-facility-provisioning-${tenantId}`;

/** Held by the dedicated DDL connection until it closes, including across registry commits. */
export async function acquireProvisioningLock(connection: Connection, tenantId: number): Promise<void> {
     const [rows] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 0) AS acquired', [lockName(tenantId)]);
     if (Number(rows[0]?.acquired) !== 1) {
          throw new FacilityError('Facility setup or cleanup is still running. Wait for it to finish, then refresh.', 409);
     }
}

export async function releaseProvisioningLock(connection: Connection, tenantId: number): Promise<void> {
     await connection.query('SELECT RELEASE_LOCK(?)', [lockName(tenantId)]);
}
