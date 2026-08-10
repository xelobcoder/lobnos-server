import { handleOverLoad } from "../../../hooks/helper";
import router from "../route";
import { handleReceivedIntefacingData } from "./hl7SoftwareProcessing";
import { getAllDevicesHandler, getDeviceByIdHandler, createDeviceHandler, updateDeviceHandler, deleteDeviceHandler } from "./medicalInterfacingDevicesController";


router.get("/api/v1/devices/interfacing/verified/devices", getAllDevicesHandler);
router.get("/api/v1/devices/interfacing/verified/devices/:id", handleOverLoad(getDeviceByIdHandler));
router.post("/api/v1/devices/interfacing/verified/devices", createDeviceHandler);
router.put("/api/v1/devices/interfacing/verified/devices/:id", updateDeviceHandler);
router.delete("/api/v1/devices/interfacing/verified/devices/:id", deleteDeviceHandler);
router.post(
     "/api/v1/devices/interfacing/verified/devices/receiving/data",
     handleOverLoad(handleReceivedIntefacingData)
);

export default router;
