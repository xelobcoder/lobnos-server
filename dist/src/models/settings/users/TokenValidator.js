"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class TokenValidator {
    constructor() {
        this.secretKey = process.env.ACCESS_TOKEN_SECRET;
    }
    initializeSecretKey() {
        if (!this.secretKey) {
            throw new Error('Access token secret key is not defined in environment variables');
        }
    }
    async validateAccessToken(token) {
        try {
            this.initializeSecretKey();
            const verified = jsonwebtoken_1.default.verify(token, this.secretKey);
            if (verified === null || verified === void 0 ? void 0 : verified.email)
                return { expired: false };
            return undefined;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                return { expired: true };
            }
            return undefined;
        }
    }
    async decodeAccessToken(token) {
        try {
            this.initializeSecretKey();
            const decoded = jsonwebtoken_1.default.verify(token, this.secretKey);
            return decoded;
        }
        catch (error) {
            console.error('Failed to decode access token:', error);
            return null;
        }
    }
}
exports.default = TokenValidator;
