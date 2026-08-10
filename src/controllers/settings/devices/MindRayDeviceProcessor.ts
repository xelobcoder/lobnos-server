import DeviceProcessorBase, { IObxResult } from "./DevicePrecessorBase";
import { IInterfacingDevicePayload, IObxSegment } from "./hl7SoftwareProcessing";


class MindRayDeviceProcessor extends DeviceProcessorBase<IInterfacingDevicePayload> {
     protected extractPatientId(payload: IInterfacingDevicePayload): string {
          return (payload as any).PatientID;
     }

     private normalizeObxSegments(payload: IInterfacingDevicePayload): IObxSegment[] {
          return payload.data.filter(seg => {
               if (seg.SEGMENT !== 'OBX') return false;

               if (!seg.OBSERVATION_SUB_ID || seg.OBSERVATION_SUB_ID.trim() === "") {
                    seg.OBSERVATION_SUB_ID = seg.OBSERVATION_ID;
               }

               if (typeof seg.OBSERVATION_SUB_ID === 'string' && seg.OBSERVATION_SUB_ID.includes('^')) {
                    const parts = seg.OBSERVATION_SUB_ID.split('^');
                    if (parts.length >= 2) {
                         seg.OBSERVATION_SUB_ID = parts[1];
                    }
               }

               return true;
          }) as IObxSegment[];
     }

     protected buildObxResults(
          payload: IInterfacingDevicePayload,
          deviceInterfaceMapping: Record<string, any> | null,
          testCreationRules: any[]
     ): IObxResult[] {
          const obxSegments = this.normalizeObxSegments(payload);
          const obxResults: IObxResult[] = [];

          if (deviceInterfaceMapping && typeof deviceInterfaceMapping === 'object') {
               for (const [deviceCode, mappedAnalyte] of Object.entries(deviceInterfaceMapping)) {
                    const fieldIdNumber = Number(deviceCode);
                    const rule = testCreationRules.find(r => r.id === fieldIdNumber);
                    const mappedValue = String(mappedAnalyte).trim();

                    const matchedSegment = obxSegments.find(seg =>
                         seg.OBSERVATION_SUB_ID === mappedValue ||
                         seg.OBSERVATION_SUB_ID === String(fieldIdNumber)
                    );

                    if (!matchedSegment) continue;

                    const value = (matchedSegment as any).VALUE;

                    obxResults.push({
                         fieldid: fieldIdNumber,
                         value,
                         originalvalue: value,
                         field: rule?.name || '',
                         entrymode: 'automatic'
                    });
               }
          }

          return obxResults;
     }
}

export default MindRayDeviceProcessor;