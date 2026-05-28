"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logDir = 'logs';
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir);
}
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, service, host } = info, meta = __rest(info, ["timestamp", "level", "message", "service", "host"]);
    // Remove internal winston symbols and properties we don't want in the stringified meta
    const cleanMeta = Object.assign({}, meta);
    delete cleanMeta[Symbol.for('level')];
    delete cleanMeta[Symbol.for('message')];
    delete cleanMeta[Symbol.for('splat')];
    const metaString = Object.keys(cleanMeta).length ? JSON.stringify(cleanMeta) : '';
    return `${timestamp} [${level}] ${message} ${metaString}`;
}));
const logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    defaultMeta: {
        service: 'lobnos-server',
        host: os_1.default.hostname(),
        platform: os_1.default.platform(),
        arch: os_1.default.arch()
    },
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        // Combined log for everything (info and above)
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Separate log for errors only
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Console output with colors and readable format
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), customFormat)
        }),
    ],
});
process.on('uncaughtException', (ex) => {
    logger.error('Uncaught Exception', {
        error: ex.message,
        stack: ex.stack
    });
    // Give time for logger to write to file before exiting
    setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: (reason === null || reason === void 0 ? void 0 : reason.message) || reason,
        stack: reason === null || reason === void 0 ? void 0 : reason.stack
    });
});
exports.default = logger;
