"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const UnitsController_1 = require("../UnitsController");
const router = (0, express_1.Router)();
const unitsController = new UnitsController_1.UnitsController();
// Unit management routes
router.get('/units', (req, res) => unitsController.getAvailableUnits(req, res));
router.post('/units', (req, res) => unitsController.createCustomUnit(req, res));
router.get('/units/:unitId/validate', (req, res) => unitsController.validateUnit(req, res));
exports.default = router;
