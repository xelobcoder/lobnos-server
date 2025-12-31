"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const crypto_1 = __importDefault(require("crypto"));
class PrimeWindowAccessRepository {
    constructor(tenantId) {
        this.tableName = 'prime_window_access';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    hashDate(date) {
        const text = date.toISOString();
        const algorithm = 'aes-256-cbc';
        const key = crypto_1.default.scryptSync(process.env.PRIME_WINDOWS_KEY, 'salt', 32);
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }
    dehashDate(encrypted) {
        const parts = encrypted.split(':');
        if (parts.length === 2) {
            // Try AES decryption
            try {
                const algorithm = 'aes-256-cbc';
                const key = crypto_1.default.scryptSync(process.env.PRIME_WINDOWS_KEY, 'salt', 32);
                const iv = Buffer.from(parts.shift(), 'hex');
                const encryptedText = Buffer.from(parts.join(':'), 'hex');
                const decipher = crypto_1.default.createDecipheriv(algorithm, key, iv);
                let decrypted = decipher.update(encryptedText);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return new Date(decrypted.toString());
            }
            catch (e) {
                throw new Error('AES decryption failed');
            }
        }
        else {
            // Fallback to old base64 method
            try {
                const decoded = atob(encrypted);
                const replaced = decoded.replace(process.env.PRIME_WINDOWS_KEY, '');
                return new Date(replaced);
            }
            catch (e2) {
                throw new Error('Failed to dehash date');
            }
        }
    }
    async getCurrentWindow() {
        const connection = await this.connection;
        const window = await connection(this.tableName)
            .orderBy('id', 'desc')
            .first();
        if (window) {
            window.start_period = this.dehashDate(window.start_period);
            window.end_period = this.dehashDate(window.end_period);
        }
        return window;
    }
    async validateLicense() {
        const window = await this.getCurrentWindow();
        if (!window)
            return false;
        const now = new Date();
        const start = new Date(window.start_period);
        const end = new Date(window.end_period);
        const gracePeriodEnd = new Date(end.getTime() + window.window_days * 24 * 60 * 60 * 1000);
        if (window.islicensedRenewed) {
            return now >= start && now <= end;
        }
        else {
            return now >= end && now <= gracePeriodEnd;
        }
    }
    async createWindow(startPeriod, endPeriod, windowDays = 3, islicensedRenewed = false, loginDurationPerUser = 6) {
        const connection = await this.connection;
        const [id] = await connection(this.tableName).insert({
            start_period: this.hashDate(startPeriod),
            end_period: this.hashDate(endPeriod),
            window_days: windowDays,
            islicensedRenewed: islicensedRenewed,
            loginDurationPerUser: loginDurationPerUser
        });
        return id;
    }
    async updateWindow(id, updates) {
        const connection = await this.connection;
        await connection(this.tableName).where({ id }).update(updates);
    }
    async checkDuplicateYearPeriod(startPeriod, endPeriod) {
        const connection = await this.connection;
        const windows = await connection(this.tableName).where('islicensedRenewed', true);
        const startYear = startPeriod.getFullYear();
        const endYear = endPeriod.getFullYear();
        for (const w of windows) {
            const wStart = this.dehashDate(w.start_period);
            const wEnd = this.dehashDate(w.end_period);
            if (wStart.getFullYear() === startYear && wEnd.getFullYear() === endYear) {
                return true;
            }
        }
        return false;
    }
    async calculateDaysToExpiry() {
        const window = await this.getCurrentWindow();
        if (!window)
            return null;
        const now = new Date();
        const end = new Date(window.end_period);
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
}
exports.default = PrimeWindowAccessRepository;
