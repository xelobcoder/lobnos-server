"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const handlers_1 = require("./handlers");
// Drug Category Routes
router.post('/api/v1/drugsCategory', handlers_1.insertNewDrugCategory);
router.get('/api/v1/drugsCategory', handlers_1.getDrugsCategory);
router.put('/api/v1/drugsCategory', handlers_1.updateDrugCategory);
router.delete('/api/v1/drugsCategory/:id', handlers_1.deleteDrugCategory);
// Drug Routes
router.post('/api/v1/drugs', handlers_1.insertNewDrug);
router.get('/api/v1/drugs', handlers_1.getDrugs);
router.put('/api/v1/drugs', handlers_1.updateDrug);
router.delete('/api/v1/drugs', handlers_1.deleteDrug);
exports.default = router;
