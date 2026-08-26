import KnexConnection from '../../../database/KnexConnections';

export default class PatientService {
     private connection: any;
     private tableName = 'new_patients';

     constructor(private tenantId: number, trx?: any) {
          this.connection = trx || KnexConnection(tenantId);
     }

     async patientMobileRecordExist(mobile: number | string): Promise<boolean> {
          try {
               const mobileStr = String(mobile).trim();
               if (!mobileStr || mobileStr.length === 0) return false;
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where('mobile_number', mobileStr)
                    .first();
               return !!result;
          } catch (error) {
               throw new Error(`Error checking mobile record existence: ${error instanceof Error ? error.message : String(error)}`);
          }
     }

     async moveDuplicateSelfMobileToRelative(data: any): Promise<void> {
          const mobile = data?.mobile_number ?? data?.mobile;
          if (data?.contact_pointer !== 'self' || !mobile) return;

          const isRecordExist = await this.patientMobileRecordExist(mobile as number | string);
          if (!isRecordExist) return;

          data.contact_pointer = 'relative';
          data.mobileownership = 'relative';
          data.relativecontactnumber = data.relativecontactnumber ?? mobile;
          data.mobile_number = null;
          data.mobile = null;
     }
}
