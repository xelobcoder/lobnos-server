import BioLabDeviceProcessor from "./BioLabDeviceProcessor";
import MindRayDeviceProcessor from "./MindRayDeviceProcessor";
import { BioLabInterfacingMessage } from "./interface/IBioLab";
import { IInterfacingDevicePayload } from "./hl7SoftwareProcessing";
import AgileS20DeviceProcessor from "./AgileS20DeviceProcessor";

class DeviceModelsVersionProcessing {
     static bioLabDeviceProcessor(tenantId: number, payload: BioLabInterfacingMessage, actorEmployeeId: number) {
          return new BioLabDeviceProcessor(tenantId).process(payload, actorEmployeeId);
     }

     static MindRayDeviceBClassProcessor(tenantId: number, payload: IInterfacingDevicePayload, actorEmployeeId: number) {
          return new MindRayDeviceProcessor(tenantId).process(payload, actorEmployeeId);
     }

     static AgileS20DeviceProcessor(tenantId: number, payload: IInterfacingDevicePayload, actorEmployeeId: number) {
          return new AgileS20DeviceProcessor(tenantId).process(payload, actorEmployeeId);
     }
}

export default DeviceModelsVersionProcessing;