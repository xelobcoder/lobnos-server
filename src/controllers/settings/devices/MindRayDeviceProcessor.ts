import DeviceProcessorBase, { IObxResult } from "./DevicePrecessorBase";
import { IInterfacingDevicePayload } from "./hl7SoftwareProcessing";
import { extractPidPatientId, normalizeObxSegments } from "./hl7SegmentHelpers";


class MindRayDeviceProcessor extends DeviceProcessorBase<IInterfacingDevicePayload> {
     /**
      * Specimen barcode from PID.PATIENT_ID. The handler wraps the agent's parsed segment array as
      * { data: segments }; the agent emits no top-level PatientID, so none is read.
      */
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
                    // A matched OBX without an observation value is not a result; never save undefined.
                    if (value === undefined || value === null) continue;

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