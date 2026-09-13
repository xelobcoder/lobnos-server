import { Router } from "express";
import { getCustomers, getCustomerSummary, createNewVitalSign, getPatientVitalSign, AdvancedPatientFilterHandler } from "./controllerfn";
import { changeActivationRouter } from "../../models/activation/activate";
import { handleOverLoad } from "../../hooks/helper";

const router = Router();
const baseurl = '/api/v1';

router.get(`${baseurl}/customers`, getCustomers);
router.get(`${baseurl}/customers/summary`, getCustomerSummary);
router.post(`${baseurl}/customer/advanced/filter`, AdvancedPatientFilterHandler)
router.get(`${baseurl}/customer/activation/status/change`, changeActivationRouter);
router.get(`${baseurl}/customers/vitalsigns/create`, handleOverLoad(getPatientVitalSign));
router.post(`${baseurl}/customers/vitalsigns/create`, createNewVitalSign);

export default router;
