"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUploadCompanyImage = exports.getCompanyImageHandler = exports.getCompanyInfoHandler = exports.AddCompanyInfoHandler = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const logger_1 = __importDefault(require("../../../hooks/logger"));
const companyProfile_1 = require("../../../models/settings/companyProfile");
const imageUpload_1 = require("./imageUpload");
const helper_1 = require("../../../hooks/helper");
const AddCompanyInfoHandler = async (request, response) => {
    try {
        const { name, motto, email, phonenumber } = request.body;
        const tenantId = parseInt(request.query.tenantId.toString());
        const hasNecessaryRequestBodyParams = name && motto && email && phonenumber;
        if (!hasNecessaryRequestBodyParams)
            return (0, helper_1.customError)("The type of request body is invalid" /* OperationsFailures.invalidRequestBodyType */ + ". Necessary request body params not included", 400, response);
        await (0, companyProfile_1.truncateCompanyProfile)(tenantId);
        await (0, companyProfile_1.insertCompanyProfile)(tenantId, request.body);
        return response.send({ status: "success" });
    }
    catch (err) {
        console.log(err);
        return (0, helper_1.responseError)(response);
    }
};
exports.AddCompanyInfoHandler = AddCompanyInfoHandler;
const getCompanyInfoHandler = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        let result = await (0, companyProfile_1.getAllCompanyProfiles)(tenantId);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getCompanyInfoHandler = getCompanyInfoHandler;
const getCompanyImageHandler = async (request, response) => {
    try {
        const folderPath = path_1.default.resolve(process.cwd(), "dist", "asserts", "company");
        // Performance optimization: Use async file operations instead of sync
        try {
            await fs_1.promises.access(folderPath);
        }
        catch (_a) {
            await fs_1.promises.mkdir(folderPath, { recursive: true });
        }
        const files = await fs_1.promises.readdir(folderPath);
        const imageFile = files.find((file) => [".jpg", ".jpeg", ".png", ".gif"].includes(path_1.default.extname(file).toLowerCase()));
        if (imageFile) {
            const imagePath = path_1.default.join(folderPath, imageFile);
            const image = await fs_1.promises.readFile(imagePath);
            response.setHeader("Content-Type", "image/jpeg");
            response.setHeader("Content-Length", image.length.toString());
            response.send(image);
        }
        else {
            response.status(404).send("Image not found");
        }
    }
    catch (error) {
        logger_1.default.error(error);
        response.status(500).send("Internal Server Error");
    }
};
exports.getCompanyImageHandler = getCompanyImageHandler;
const handleUploadCompanyImage = async (request, response) => {
    const destinationDir = path_1.default.resolve(process.cwd(), 'dist', 'asserts', 'company');
    // Performance optimization: Use async file operations instead of sync
    try {
        await fs_1.promises.access(destinationDir);
    }
    catch (_a) {
        await fs_1.promises.mkdir(destinationDir, { recursive: true });
    }
    const field = "file";
    try {
        // Remove existing images before uploading new one
        const files = await fs_1.promises.readdir(destinationDir);
        // Performance optimization: Use Promise.all to delete files in parallel
        await Promise.all(files
            .filter(file => [".jpg", ".jpeg", ".png", ".gif"].includes(path_1.default.extname(file).toLowerCase()))
            .map(file => fs_1.promises.unlink(path_1.default.join(destinationDir, file))));
        const uploadResult = await (0, imageUpload_1.uploadImageFile)(request, response, destinationDir, field);
        if (uploadResult) {
            response.status(200).json({
                status: "success",
                message: "Company image uploaded successfully",
            });
        }
        else {
            response.status(400).json({
                status: "error",
                message: "No image uploaded or invalid file type",
            });
        }
    }
    catch (error) {
        console.log(error);
        response.status(500).json({
            status: "error",
            message: "Failed to upload image",
        });
    }
};
exports.handleUploadCompanyImage = handleUploadCompanyImage;
