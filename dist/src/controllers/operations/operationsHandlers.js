"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLaboratoryOperations = exports.getUltrasoundWaitingList = exports.getAllPendingCases = exports.getAllTestPreview = exports.getAscensionOverViewModelTransactionHandler = exports.getAscensionOverViewModelHandler = exports.getAllEnterResult = exports.getAllCollections = exports.serveUltrasoundImageHandler = exports.deleteUltrasoundImageHandler = exports.getUltrasoundImagesHandler = exports.uploadUltrasoundImagesHandler = void 0;
const operations_1 = __importDefault(require("../../models/operations/operations"));
const helper_1 = require("../../hooks/helper");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Configure multer for ultrasound images
const ultrasoundStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path_1.default.join(process.cwd(), "public", "uploads", "ultrasound");
        if (!fs_1.default.existsSync(uploadPath)) {
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `ultrasound-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    }
});
const uploadUltrasound = (0, multer_1.default)({
    storage: ultrasoundStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only image files are allowed!"));
    }
}).array("file", 10);
exports.uploadUltrasoundImagesHandler = (0, helper_1.handleOverLoad)(async (req, res) => {
    uploadUltrasound(req, res, async (err) => {
        if (err) {
            return (0, helper_1.customError)(err.message, 400, res);
        }
        const files = req.files;
        if (!files || files.length === 0) {
            return (0, helper_1.customError)("No files uploaded", 400, res);
        }
        const { ascensionid, testid, patientid } = req.body;
        const { tenantId } = req.query;
        if (!ascensionid || !testid || !patientid || !tenantId) {
            // Clean up uploaded files if validation fails
            files.forEach(file => fs_1.default.unlinkSync(file.path));
            return (0, helper_1.customError)("ascensionid, testid, patientid and tenantId are required", 400, res);
        }
        const tId = parseInt(tenantId, 10);
        const uploadPromises = files.map(file => operations_1.default.uploadUltrasoundImages(tId, {
            ascensionid: parseInt(ascensionid),
            testid: parseInt(testid),
            patientid: parseInt(patientid),
            filename: file.filename
        }));
        const results = await Promise.all(uploadPromises);
        const successCount = results.filter(r => r).length;
        res.send({
            statusCode: 200,
            message: `${successCount} images uploaded successfully`,
            results: files.map(f => f.filename)
        });
    });
});
exports.getUltrasoundImagesHandler = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { ascensionid } = req.params;
        const { tenantId } = req.query;
        if (!ascensionid || !tenantId) {
            return (0, helper_1.customError)("ascensionid and tenantId are required", 400, res);
        }
        const tId = parseInt(tenantId, 10);
        const ascId = parseInt(ascensionid);
        if (isNaN(ascId)) {
            return res.send({
                statusCode: 200,
                message: "success",
                result: []
            });
        }
        const images = await operations_1.default.getUltrasoundImagesByAscension(tId, ascId);
        res.send({
            statusCode: 200,
            message: "success",
            result: images
        });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
});
exports.deleteUltrasoundImageHandler = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId } = req.query;
        if (!id || !tenantId) {
            return (0, helper_1.customError)("id and tenantId are required", 400, res);
        }
        const tId = parseInt(tenantId, 10);
        const imageId = parseInt(id);
        if (isNaN(imageId)) {
            return (0, helper_1.customError)("Invalid image ID", 400, res);
        }
        // 1. Get image info to find filename
        const image = await operations_1.default.getUltrasoundImageById(tId, imageId);
        if (!image) {
            return (0, helper_1.customError)("Image not found", 404, res);
        }
        // 2. Delete from database
        const deleted = await operations_1.default.deleteUltrasoundImage(tId, imageId);
        if (!deleted) {
            return (0, helper_1.customError)("Failed to delete image from database", 500, res);
        }
        // 3. Delete from filesystem
        const filePath = path_1.default.join(process.cwd(), "public", "uploads", "ultrasound", image.filename);
        if (fs_1.default.existsSync(filePath)) {
            try {
                fs_1.default.unlinkSync(filePath);
            }
            catch (err) {
                console.error(`Failed to delete file: ${filePath}`, err);
                // We don't return error here because database record is already gone
            }
        }
        res.send({
            statusCode: 200,
            message: "Image deleted successfully"
        });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
});
exports.serveUltrasoundImageHandler = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path_1.default.join(process.cwd(), "public", "uploads", "ultrasound", filename);
        if (fs_1.default.existsSync(filePath)) {
            res.sendFile(filePath);
        }
        else {
            res.status(404).send("Image not found");
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
});
const getAllCollections = async (req, res) => {
    try {
        const { departmentid, branchid, tenantId } = req.query;
        if (!departmentid || !tenantId || !branchid)
            return (0, helper_1.customError)("departmentid, branchid or tenantId not included in request query", 400, res);
        const tId = parseInt(tenantId, 10);
        const collections = new operations_1.default(0);
        const result = await collections.getLaboratoryTestReadyForResultEntry(tId, departmentid, parseInt(branchid.toString()));
        res.send({ statusCode: 200, message: "success", result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllCollections = getAllCollections;
const getAllEnterResult = async (req, res) => {
    try {
        const { tenantId } = req.query;
        if (!tenantId)
            return (0, helper_1.customError)("tenantId not included", 400, res);
        const tId = parseInt(tenantId, 10);
        const result = await new operations_1.default(0).getAllEnterResult(tId, req.query);
        res.send({ result, statusCode: 200 });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllEnterResult = getAllEnterResult;
const getAscensionOverViewModelHandler = async (req, res) => {
    try {
        const { tenantid, date, patientid, billingid } = req.query;
        // Date is required unless we are filtering by patientid or billingid
        if (!date && !patientid && !billingid) {
            return (0, helper_1.customError)("date, patientid or billingid must be included in request query", 400, res);
        }
        const tId = parseInt(tenantid, 10);
        const result = await operations_1.default.getAscensionOverViewModel(tId, date ? date.toString() : "all", {
            patientid: patientid ? parseInt(patientid.toString()) : undefined,
            billingid: billingid ? parseInt(billingid.toString()) : undefined
        });
        res.send({ statusCode: 200, message: "success", result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAscensionOverViewModelHandler = getAscensionOverViewModelHandler;
const getAscensionOverViewModelTransactionHandler = async (req, res) => {
    try {
        const { tenantid, billingid } = req.query;
        if (!billingid)
            return (0, helper_1.customError)("billingid not included in request query", 400, res);
        const tId = parseInt(tenantid, 10);
        const result = await operations_1.default.getAscensionOverViewModelTransaction(tId, parseInt(billingid.toString()));
        res.send({ statusCode: 200, message: "success", result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAscensionOverViewModelTransactionHandler = getAscensionOverViewModelTransactionHandler;
const getAllTestPreview = async (req, res) => {
    try {
        const { billingid, tenantId } = req.query;
        if (!billingid || !tenantId)
            return (0, helper_1.customError)("billingid or tenantId required", 400, res);
        const tId = parseInt(tenantId, 10);
        const result = await new operations_1.default(0).getAllTestPreview(tId, parseInt(billingid.toString()));
        res.send({ statusCode: 200, result, status: "success" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllTestPreview = getAllTestPreview;
const getAllPendingCases = async (req, res) => {
    try {
        const { tenantId, count = 10, page = 1, departmentid, status, testid, billingid, fullname, from, to } = req.query;
        if (!tenantId)
            return (0, helper_1.customError)("tenantId not included", 400, res);
        const tId = parseInt(tenantId, 10);
        const data = { count, page, departmentid, status, testid, fullname, from, to, billingid };
        const result = await new operations_1.default(0).getAllCasesResultEntryByMany(tId, data);
        res.send({ result, statusCode: 200, status: "success" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllPendingCases = getAllPendingCases;
const getUltrasoundWaitingList = async (req, res) => {
    try {
        const { page, count, tenantId } = req.query;
        if (!tenantId)
            return (0, helper_1.customError)("tenantId not included", 400, res);
        const tId = parseInt(tenantId, 10);
        const parsedCount = parseInt(count ? count.toString() || '10' : '10', 10);
        const parsedPage = parseInt(page ? page.toString() || '1' : '1', 10);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getUltrasoundWaitingList = getUltrasoundWaitingList;
const searchLaboratoryOperations = async (req, res) => {
    try {
        const { tenantId, page = '1', count = '10', patientId, billingId, accessionId, start_date, end_date } = req.query;
        if (!patientId && !billingId && !accessionId && !start_date && !end_date) {
            return (0, helper_1.customError)("At least one search parameter is required: patientId, billingId, or accessionId", 400, res);
        }
        const tId = parseInt(tenantId, 10);
        const pageNum = Math.max(1, parseInt(page.toString()) || 1);
        const countNum = Math.max(1, Math.min(100, parseInt(count.toString()) || 10));
        const result = await new operations_1.default(0).searchLaboratoryOperations(tId, {
            patientId: patientId ? parseInt(patientId.toString()) : undefined,
            billingId: billingId ? parseInt(billingId.toString()) : undefined,
            accessionId: accessionId === null || accessionId === void 0 ? void 0 : accessionId.toString(),
            page: pageNum,
            count: countNum,
            start_date: start_date === null || start_date === void 0 ? void 0 : start_date.toString(),
            end_date: end_date === null || end_date === void 0 ? void 0 : end_date.toString()
        });
        res.send({
            statusCode: 200,
            status: "success",
            message: "Laboratory operations search completed",
            data: result
        });
    }
    catch (err) {
        2;
        return (0, helper_1.customError)("Failed to retrieve laboratory operations data. Please try again later.", 500, res);
    }
};
exports.searchLaboratoryOperations = searchLaboratoryOperations;
