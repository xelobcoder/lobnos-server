import express from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireOwnerRole } from '../../middleware/authority';
import {
  getApplicationSettings,
  getApplicationSettingsBilling,
  updateApplicationSettings,
  updateApplicationBillSettingsHandler,
  updateSmsSettings,
  getSmsSettings,
  getEmailPreference,
  getGeneralEmailSettings,
  updateGeneralEmailSettings,
  updateEmailPreference,
  resultEntrySettingsUpdateHandler,
  updateRegistrationFields,
  getRegistrationSettings,
  addTax,
  getTax,
  resultEntrySettingsHandler,
  updateTax,
  changeTaxStatus,
  deleteTax,
  getResultSettings,
  updateResultSettings,
  TableFiltering,
  columnFiltering,
  getCategoryColumns
} from "./handler";

const router = express.Router();

router.get("/api/v1/applicationsettings", getApplicationSettings);
router.put("/api/v1/applicationsettings/updates/billingsettings", updateApplicationBillSettingsHandler);
router.get("/api/v1/applicationsettings/target/:target", getApplicationSettings);
router.get("/api/v1/applicationsettings/billing", getApplicationSettingsBilling);
router.post("/api/v1/applicationsettings", checkTokenExists, requireOwnerRole, updateApplicationSettings as unknown as express.RequestHandler);
router.get("/api/v1/application/sms/create/template/columns", getCategoryColumns);
router.put("/api/v1/applicationsettings/smsupdate", updateSmsSettings);
router.get("/api/v1/applicationsettings/smsupdate", getSmsSettings);
router.get("/api/v1/applicationssettings/emailpreference", getEmailPreference);
router.get("/api/v1/applicationssettings/email/emailsettings", getGeneralEmailSettings);
router.put("/api/v1/applicationssettings/email/emailsettings", updateGeneralEmailSettings);
router.post("/api/v1/applicationssettings/emailpreference", updateEmailPreference);
router.post("/api/v1/applicationsettings/registration/fields", updateRegistrationFields);
router.get("/api/v1/applicationsettings/registration/fields", getRegistrationSettings);
router.post("/api/v1/application/tax", addTax);
router.get("/api/v1/application/tax", getTax);
router.put("/api/v1/application/tax", updateTax);
router.put("/api/v1/application/tax/activation", changeTaxStatus);
router.delete("/api/v1/application/tax", deleteTax);
router.get("/api/v1/applicationsetting/resultsettings", getResultSettings);
router.put("/api/v1/applicationsetting/resultsettings", updateResultSettings);
router.get("/api/v1/applicationsetting/resultsettings/resultentrysettings", resultEntrySettingsHandler);
router.put("/api/v1/applicationsetting/resultsettings/resultentrysettings", resultEntrySettingsUpdateHandler)

router.get('/api/v1/application/filtering/table/:tablename', TableFiltering)
router.get('/api/v1/application/get-column/:column', columnFiltering)

export default router;