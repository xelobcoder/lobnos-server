"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_FILE = process.env.SMS_LOG_FILE || path_1.default.join(__dirname, '../../../../errorlogs.txt');
const LOG_LEVEL = process.env.SMS_LOG_LEVEL || 'error'; // 'error', 'info', 'silent'
function logToFile(message) {
    try {
        fs_1.default.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
    }
    catch (e) {
        // Fallback: do nothing
    }
}
exports.Logger = {
    error: (msg, err) => {
        if (LOG_LEVEL === 'silent')
            return;
        const errorMsg = err ? `${msg} ${err instanceof Error ? err.stack : JSON.stringify(err)}` : msg;
        logToFile(errorMsg);
    },
    info: (msg) => {
        if (LOG_LEVEL !== 'info')
            return;
        logToFile(msg);
    }
};
