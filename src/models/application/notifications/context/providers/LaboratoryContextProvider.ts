import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';

export class LaboratoryContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(_referenceId?: number | string): Promise<Record<string, unknown>> {
          const connection = await this.connection;
          const company = await connection('companyprofile')
               .select('name', 'email', 'phonenumber', 'address', 'website')
               .first();

          if (!company) {
               return {
                    laboratory_name: 'Prime Laboratory Services',
                    laboratory_email: '',
                    laboratory_phone: '',
                    laboratory_address: '',
                    laboratory_website: '',
               };
          }

          return {
               laboratory_name: company.name || 'Prime Laboratory Services',
               laboratory_email: company.email || '',
               laboratory_phone: company.phonenumber || '',
               laboratory_address: company.address || '',
               laboratory_website: company.website || '',
          };
     }
}
