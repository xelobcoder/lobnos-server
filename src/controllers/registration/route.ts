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
} from "./registrationHandlers";
import { CheckMobileNumberDto, CheckPatientIdDto } from "../../models/patients/dto/checkMobileNoDto.dto";
import { getNotificationSettingsHandler, getTransactionsByDateHandler, updateCredentialsHandler, updateNotificationSettingsHandler } from "./PatientsHandler";
import { validateDtoMiddleware } from "../../middleware/validateDto.middleware";
import { CreateNewPatientDto } from "../../models/patients/dto/newPatientDto";
import { UpdatePatientDto } from "../../models/patients/dto/updatePatientDto";
import { UpdatePatientEmergencyContactDto } from "../../models/patients/dto/emmergencyPatientDto";
import { PatientAddressingDto } from "../../models/patients/dto/addressingPatientDto.dto";
import { PatientCredentialsDto } from "../../models/patients/dto/patientCredentialsDto.dto";

const router = express.Router();

router.post("/api/v1/register", validateDtoMiddleware(CreateNewPatientDto, 'body'), addNewPatient);
router.put("/api/v1/register/personalinformation", validateDtoMiddleware(UpdatePatientDto), updatePersonalInformation);
router.put("/api/v1/register/emmergencycontactinformation", validateDtoMiddleware(UpdatePatientEmergencyContactDto), updateEmergencyContactInformation);
router.put("/api/v1/register/addressinginformation", validateDtoMiddleware(PatientAddressingDto), updateAddressingInformation);
router.get("/api/v1/register/personalinformation", validateDtoMiddleware(CheckPatientIdDto, "query"), getPersonalInformation);
router.get("/api/v1/register/personalinformation/audit", getPatientAuditHistoryHandler);
router.get("/api/v1/register/checkmobile", validateDtoMiddleware(CheckMobileNumberDto, "query"), checkMobileNumber);
router.get("/api/v1/register/addressinginformation", validateDtoMiddleware(CheckPatientIdDto, "query"), getAddressingInformation);
router.get("/api/v1/register/emmergencycontactinformation", validateDtoMiddleware(CheckPatientIdDto, "query"), getEmergencyContactInformation);
router.get("/api/v1/register/registration/settings", getRegistrationSettings);


// PATIENTS ROUTER


router.get("/api/v1/patients/analytics/date", getTransactionsByDateHandler);
router.post("/api/v1/patients/updatecredentials", validateDtoMiddleware(PatientCredentialsDto, "body"), updateCredentialsHandler);
router.put("/api/v1/patients/notifications", updateNotificationSettingsHandler);
router.get("/api/v1/patients/notifications", getNotificationSettingsHandler);



export default router;
