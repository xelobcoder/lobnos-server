import express from "express";
import {
  addNewPatient,
  updatePersonalInformation,
  updateEmergencyContactInformation,
  updateAddressingInformation,
  getPersonalInformation,
  getPatientAuditHistoryHandler,
  checkMobileNumber,
  getAddressingInformation,
  getEmergencyContactInformation,
  getRegistrationSettings,
  getPatientImagePathHandler,
} from "./registrationHandlers"
import { getNotificationSettingsHandler, getTransactionsByDateHandler, updateCredentialsHandler, updateNotificationSettingsHandler } from "./PatientsHandler";

const router = express.Router();

router.post("/api/v1/register", addNewPatient);
router.put("/api/v1/register/personalinformation", updatePersonalInformation);
router.put("/api/v1/register/emmergencycontactinformation", updateEmergencyContactInformation);
router.put("/api/v1/register/addressinginformation", updateAddressingInformation);
router.get("/api/v1/register/personalinformation", getPersonalInformation);
router.get("/api/v1/register/personalinformation/audit", getPatientAuditHistoryHandler);
router.get("/api/v1/register/checkmobile", checkMobileNumber);
router.get("/api/v1/register/addressingformation", getAddressingInformation);
router.get("/api/v1/register/emmergencycontactinformation", getEmergencyContactInformation);
router.get("/api/v1/register/registration/settings", getRegistrationSettings);
router.get("/api/v1/patients/images",getPatientImagePathHandler)


// PATIENTS ROUTER


router.get("/api/v1/patients/analytics/date", getTransactionsByDateHandler);
router.post("/api/v1/patients/updatecredentials", updateCredentialsHandler);
router.put("/api/v1/patients/notifications", updateNotificationSettingsHandler);
router.get("/api/v1/patients/notifications", getNotificationSettingsHandler);



export default router;
