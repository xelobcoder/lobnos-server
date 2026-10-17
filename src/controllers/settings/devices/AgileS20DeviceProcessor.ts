import DeviceProcessorBase, { IObxResult } from "./DevicePrecessorBase";
import { IInterfacingDevicePayload } from "./hl7SoftwareProcessing";
import { extractPidPatientId, normalizeObxSegments } from "./hl7SegmentHelpers";


class AgileS20DeviceProcessor extends DeviceProcessorBase<IInterfacingDevicePayload> {
     protected extractPatientId(payload: IInterfacingDevicePayload): string {
          return extractPidPatientId(payload);
     }

     protected buildObxResults(
          payload: IInterfacingDevicePayload,
          deviceInterfaceMapping: Record<string, any> | null,
          testCreationRules: any[]
     ): IObxResult[] {
          const obxSegments = normalizeObxSegments(payload);
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