import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';
import { EventDefinition } from './NotificationEventDefinitions';
import { buildEventDefinitionFromCatalog } from './NotificationEventCatalog';

export class DoctorContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('User/doctor reference is required');

          const connection = await this.connection;
          const row = await connection('roles')
               .select('employeeid as user_id', 'username as user_name', 'email as user_email', 'branch as branch_id', 'role as user_role')
               .where('employeeid', Number(referenceId))
               .first();

          if (!row) throw new Error('User not found');

          return row;
     }

     supportsEvent(eventCode: string): boolean {
          return eventCode.startsWith('USER_') || eventCode === 'PASSWORD_RESET' || eventCode.startsWith('SECURITY_');
     }

     getEventDefinition(eventCode: string): EventDefinition | null {
          if (!this.supportsEvent(eventCode)) return null;
          return buildEventDefinitionFromCatalog(eventCode) ?? null;
     }
}
