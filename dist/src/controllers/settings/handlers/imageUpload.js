"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageFile = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const configureMulterStorage = (destinationDir) => {
    return multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const folderPath = path_1.default.isAbsolute(destinationDir)
                ? destinationDir
                : path_1.default.join(__dirname, "..", destinationDir);
            cb(null, folderPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
        },
    });
};
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const isAllowedMimeType = allowedTypes.test(file.mimetype);
    const isAllowedExtname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    if (isAllowedMimeType && isAllowedExtname) {
        cb(null, true);
    }
    else {
        cb(new Error("Only JPEG and PNG files are allowed"));
    }
};
const uploadImageFile = async (request, response, destinationDir, field) => {
    const upload = (0, multer_1.default)({
        storage: configureMulterStorage(destinationDir),
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }).single(field);
    try {
        return new Promise((resolve, reject) => {
            upload(request, response, (err) => {
                if (err) {
                    reject(err);
                }
                else if (!request.file) {
                    reject(null);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    catch (error) {
        return null;
    }
};
exports.uploadImageFile = uploadImageFile;
