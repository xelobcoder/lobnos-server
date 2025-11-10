"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReceiptController_1 = require("../../controllers/inventory/ReceiptController");
const fileuploads_1 = __importDefault(require("../../models/uploads/fileuploads"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const receiptController = new ReceiptController_1.ReceiptController();
// Create file uploader for receipts
const uploadDir = path_1.default.join(__dirname, '../../public/uploads');
const fileUploader = (0, fileuploads_1.default)(uploadDir);
// Upload receipt image
router.post('/receipts/:receipt_id/upload-image', fileUploader.getMulterMiddleware().single('image'), fileUploader.handleUpload, (req, res) => receiptController.uploadReceiptImage(req, res));
// Get receipt image
router.get('/receipts/images/:filename', (req, res) => receiptController.getReceiptImage(req, res));
exports.default = router;
