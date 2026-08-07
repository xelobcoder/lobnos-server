import { NotificationContextProvider } from './NotificationContextProvider';
import { SampleContextProvider } from './SampleContextProvider';

export class ResultContextProvider implements NotificationContextProvider {
     private sampleProvider: SampleContextProvider;

     constructor(private tenantId: number) {
          this.sampleProvider = new SampleContextProvider(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          const sampleContext = await this.sampleProvider.getContext(referenceId);

          return {
               ...sampleContext,
               result_status: 'available',
               report_status: 'generated',
          };
     }

     supportsEvent(_eventCode: string): boolean {
          return false;
     }

     getEventDefinition(_eventCode: string) {
          return null;
     }
}
