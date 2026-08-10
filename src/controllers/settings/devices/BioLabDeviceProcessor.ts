import DeviceProcessorBase, { IObxResult } from "./DevicePrecessorBase";
import { BioLabInterfacingMessage } from "./interface/IBioLab";

class BioLabDeviceProcessor extends DeviceProcessorBase<BioLabInterfacingMessage> {
     protected extractPatientId(payload: BioLabInterfacingMessage): string {
          return payload.PatientID;
     }

     protected buildObxResults(
          payload: BioLabInterfacingMessage,
          deviceInterfaceMapping: Record<string, any> | null,
          testCreationRules: any[]
     ): IObxResult[] {
          const obxResults: IObxResult[] = [];

          if (deviceInterfaceMapping && typeof deviceInterfaceMapping === 'object') {
               for (const [deviceCode, mappedAnalyte] of Object.entries(deviceInterfaceMapping)) {
                    const fieldIdNumber = Number(deviceCode);
                    const rule = testCreationRules.find(r => r.id === fieldIdNumber);

                    const matchedResult = payload.Results.find((result) => {
                         const mappedValue = String(mappedAnalyte).trim();
                         return (
                              result.Code === mappedValue ||
                              result.Name === mappedValue ||
                              result.Code === String(fieldIdNumber) ||
                              result.Name === String(fieldIdNumber)
                         );
                    });

                    if (!matchedResult) continue;

                    obxResults.push({
                         fieldid: fieldIdNumber,
                         value: matchedResult.Value,
                         originalvalue: matchedResult.Value,
                         field: rule?.name || matchedResult.Name || '',
                         entrymode: 'automatic'
                    });
               }
          }

          return obxResults;
     }
}

export default BioLabDeviceProcessor;