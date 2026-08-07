import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';

export class BranchContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          const connection = await this.connection;

          const query = connection('branch').select('branchid', 'name', 'email', 'contact', 'address');
          const row = referenceId
               ? await query.clone().where('branchid', Number(referenceId)).first()
               : await query.clone().first();

          if (!row) return {};

          return {
               branch_id: row.branchid,
               branch_name: row.name || '',
               branch_email: row.email || '',
               branch_phone: row.contact || '',
               branch_address: row.address || '',
          };
     }
}
