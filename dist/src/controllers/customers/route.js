"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllerfn_1 = require("./controllerfn");
const activate_1 = require("../../models/activation/activate");
const router = (0, express_1.Router)();
const baseurl = '/api/v1';
// Define routes
router.get(`${baseurl}/customers`, controllerfn_1.getCustomers);
router.get(`${baseurl}/customer/activation/status/change`, activate_1.changeActivationRouter);
// Vital signs
router.get(`${baseurl}/customers/vitalsigns/create`, controllerfn_1.getPatientVitalSign);
router.post(`${baseurl}/customers/vitalsigns/create`, controllerfn_1.createNewVitalSign);
exports.default = router;
