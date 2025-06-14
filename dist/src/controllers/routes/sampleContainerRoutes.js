"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const SampleContainerController_1 = require("../samplecontainer/SampleContainerController");
const helper_1 = require("../../hooks/helper");
const router = express_1.default.Router();
router.post('/api/v1/sample/containers', (0, helper_1.handleOverLoad)(SampleContainerController_1.createContainer));
router.get('/api/v1/sample/containers', (0, helper_1.handleOverLoad)(SampleContainerController_1.getAllContainers));
router.get('/api/v1/sample/containers/:id', (0, helper_1.handleOverLoad)(SampleContainerController_1.getContainerById));
router.put('/api/v1/sample/containers/:id', (0, helper_1.handleOverLoad)(SampleContainerController_1.updateContainer));
router.delete('/api/v1/sample/containers/:id', (0, helper_1.handleOverLoad)(SampleContainerController_1.deleteContainer));
router.get('/api/v1/sample/containers/reusable', (0, helper_1.handleOverLoad)(SampleContainerController_1.getReusableContainers));
router.get('/api/v1/sample/containers/material/:material', (0, helper_1.handleOverLoad)(SampleContainerController_1.getContainersByMaterial));
exports.default = router;
