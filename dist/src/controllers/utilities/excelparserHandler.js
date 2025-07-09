"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ExcelHelper_1 = require("../../utils/ExcelHelper");
const multer_1 = __importDefault(require("multer"));
const helper_1 = require("../../hooks/helper");
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
// POST /api/utilities/parse-excel
router.post('/api/v1/parse-excel', upload.single('file'), (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No file uploaded' });
        console.log('Received file:', req.file);
        const { target } = req.body;
        const allowedTargets = ['clinician', 'organization', 'registration', 'outsource'];
        if (!target || !allowedTargets.includes(target)) {
            return res.status(400).json({ error: `Target is required and must be one of: ${allowedTargets.join(', ')}` });
        }
        const excel = new ExcelHelper_1.ExcelHelper();
        const { header, data } = await excel.parseBuffer(req.file.buffer, target);
        const two = await excel.loadAndFilterValidData(req.file.buffer, target);
        const validation = excel.filterValidData(data, target);
        res.json({ header, data, target, two, validation });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to parse Excel', details: err.message });
    }
}));
exports.default = router;
