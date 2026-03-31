"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const uploadController_1 = require("../../controllers/uploads/uploadController");
function createFileUploader(storagePath) {
    const uploadDir = storagePath ? storagePath : path_1.default.resolve(__dirname, '../../public/uploads');
    function ensureUploadDirExists(dirPath) {
        const targetDir = dirPath ? path_1.default.resolve(uploadDir, dirPath) : uploadDir;
        if (!fs_1.default.existsSync(targetDir)) {
            fs_1.default.mkdirSync(targetDir, { recursive: true });
        }
    }
    const storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const targetDir = uploadDir;
            cb(null, targetDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
        }
    });
    function getMulterMiddleware() {
        let targetDir = uploadDir;
        return (0, multer_1.default)({
            storage: multer_1.default.diskStorage({
                destination: (req, file, cb) => {
                    const category = req.query.category;
                    targetDir = category ? path_1.default.join(uploadDir, category) : uploadDir;
                    ensureUploadDirExists(targetDir);
                    cb(null, targetDir);
                },
                filename: (req, file, cb) => {
                    var _a, _b;
                    const evaluation = (_a = req.query.ptid) !== null && _a !== void 0 ? _a : 'unknown';
                    const category = (_b = req.query.category) !== null && _b !== void 0 ? _b : 'unknown';
                    if (!uploadController_1.validStoragePaths.includes(category)) {
                        cb(new Error('Invalid category specified'), '');
                        return;
                    }
                    if (fs_1.default.existsSync(targetDir)) {
                        const files = fs_1.default.readdirSync(targetDir);
                        files.forEach(file => {
                            if (file.startsWith(`${category}_${evaluation}_`)) {
                                fs_1.default.unlinkSync(path_1.default.join(targetDir, file));
                            }
                        });
                    }
                    const newFilename = `${category}_${evaluation}_${Date.now()}${path_1.default.extname(file.originalname)}`;
                    cb(null, newFilename);
                }
            }),
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Invalid file type. Only images are allowed.'));
                }
            }
        });
    }
    async function handleUpload(req, res, next) {
        try {
            if (!req.file) {
                throw new Error('No file uploaded');
            }
            req.query.savedFilename = req.file.filename;
            next();
        }
        catch (err) {
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    }
    return {
        getMulterMiddleware,
        handleUpload
    };
}
exports.default = createFileUploader;
