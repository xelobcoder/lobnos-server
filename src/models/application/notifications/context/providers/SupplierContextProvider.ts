import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';

export class SupplierContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('Supplier reference is required');

          const connection = await this.connection;
          const row = await connection('inv_suppliers')
               .select('id as supplier_id', 'name as supplier_name', 'contact as supplier_contact', 'email as supplier_email', 'phone as supplier_phone', 'address as supplier_address', 'is_active as supplier_active')
               .where('id', String(referenceId))
               .first();

          if (!row) throw new Error('Supplier not found');

          return row;
     }
}
