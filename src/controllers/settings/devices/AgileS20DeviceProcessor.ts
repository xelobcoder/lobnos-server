import DeviceProcessorBase, { IObxResult } from "./DevicePrecessorBase";
import { IInterfacingDevicePayload, IObxSegment } from "./hl7SoftwareProcessing";


class AgileS20DeviceProcessor extends DeviceProcessorBase<IInterfacingDevicePayload> {
     protected extractPatientId(payload: IInterfacingDevicePayload): string {
          const pidSegment = payload.data?.find((seg: any) =>
               typeof seg?.SEGMENT === 'string' && seg.SEGMENT.toUpperCase() === 'PID'
          );
          return String((pidSegment as any)?.PATIENT_ID ?? '').trim();
     }

     private normalizeObxSegments(payload: IInterfacingDevicePayload): IObxSegment[] {
          return payload.data.filter(seg => seg.SEGMENT === 'OBX').map(seg => {
               const normalized = { ...seg } as IObxSegment;

               if (!normalized.OBSERVATION_SUB_ID || normalized.OBSERVATION_SUB_ID.trim() === "") {
                    normalized.OBSERVATION_SUB_ID = normalized.OBSERVATION_ID;
               }

               if (typeof normalized.OBSERVATION_SUB_ID === 'string' && normalized.OBSERVATION_SUB_ID.includes('^')) {
                    const parts = normalized.OBSERVATION_SUB_ID.split('^');
                    if (parts.length >= 2) {
                         normalized.OBSERVATION_SUB_ID = parts[1];
                    }
               }
               return normalized;
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
                    const value = matchedSegment.OBSERVATION_VALUE;
                    obxResults.push({
                         fieldid: fieldIdNumber,
                         value,
                         originalvalue: value,
                         field: rule?.name || mappedValue || '',
                         entrymode: 'automatic'
                    });
               }
          }

          return obxResults;
     }
}

export default AgileS20DeviceProcessor;