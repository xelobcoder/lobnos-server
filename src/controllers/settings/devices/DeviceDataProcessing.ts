import BioLabDeviceProcessor from "./BioLabDeviceProcessor";
import MindRayDeviceProcessor from "./MindRayDeviceProcessor";
import { BioLabInterfacingMessage } from "./interface/IBioLab";
import { IInterfacingDevicePayload } from "./hl7SoftwareProcessing";
import AgileS20DeviceProcessor from "./AgileS20DeviceProcessor";

class DeviceModelsVersionProcessing {
     static bioLabDeviceProcessor(tenantId: number, payload: BioLabInterfacingMessage) {
          return new BioLabDeviceProcessor(tenantId).process(payload);
     }

     static MindRayDeviceBClassProcessor(tenantId: number, payload: IInterfacingDevicePayload) {
          return new MindRayDeviceProcessor(tenantId).process(payload);
     }

     static AgileS20DeviceProcessor(tenantId: number, payload: IInterfacingDevicePayload) {
          return new AgileS20DeviceProcessor(tenantId).process(payload);
     }
}

export default DeviceModelsVersionProcessing;