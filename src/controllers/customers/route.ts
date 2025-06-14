import { Router } from "express";
import { getCustomers, createNewVitalSign, getPatientVitalSign } from "./controllerfn";
import { changeActivationRouter } from "../../models/activation/activate";
import { handleOverLoad } from "../../hooks/helper";

const router = Router();
const baseurl = '/api/v1';

// Define routes
router.get(`${baseurl}/customers`, getCustomers);
router.get(`${baseurl}/customer/activation/status/change`, changeActivationRouter);

// Vital signs
router.get(`${baseurl}/customers/vitalsigns/create`, handleOverLoad(getPatientVitalSign));
router.post(`${baseurl}/customers/vitalsigns/create`, createNewVitalSign);

export default router;
