"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validStoragePaths = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const PatientsHandler_1 = require("../registration/PatientsHandler");
const utility_1 = require("../../hooks/utility");
const fileuploads_1 = __importDefault(require("../../models/uploads/fileuploads"));
const router = express_1.default.Router();
const baseurl = `/api/v1/`;
const uploadDir = path_1.default.join(__dirname, '../../public/uploads');
const fileUploader = (0, fileuploads_1.default)(uploadDir);
exports.validStoragePaths = ['patients', 'receipts'];
router.post(`${baseurl}storage/prime/uploads`, fileUploader.getMulterMiddleware().single('file'), fileUploader.handleUpload, PatientsHandler_1.updatePatientImageHandler);
router.post('/storage/prime/uploads/multiple');
router.get(`${baseurl}/patient/images/:filename`, (req, res) => {
    const { filename } = req.params;
    const filePath = path_1.default.join(__dirname, '../../public/uploads/patients', filename);
    (0, utility_1.sendFileResponse)(filePath, res);
});
exports.default = router;
