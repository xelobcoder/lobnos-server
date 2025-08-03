"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const zod_1 = require("zod");
class AuthenticationRepository {
    constructor(tenantId) {
        this.tablename = 'roles';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt_1.default.hash(password, saltRounds);
    }
    async validatePassword(email, password) {
        const emailSchema = zod_1.z.string().email();
        try {
            emailSchema.parse(email);
        }
        catch (error) {
            throw new Error("Invalid Email Provided");
        }
        const connection = await this.connection;
        const user = await connection(this.tablename).where({ email }).first();
        if (!user)
            return false;
        return await bcrypt_1.default.compare(password, user.password);
    }
    async generateAccessToken(email) {
        const secretKey = process.env.ACCESS_TOKEN_SECRET.toString();
        return jsonwebtoken_1.default.sign({ email }, secretKey, { expiresIn: '3h' });
    }
    async generateRefreshToken(email) {
        const secretKey = process.env.REFRESH_TOKEN_SECRET;
        return jsonwebtoken_1.default.sign({ email }, secretKey, { expiresIn: '7d' });
    }
    async login(email, password) {
        const isValidPassword = await this.validatePassword(email, password);
        if (!isValidPassword)
            return null;
        const accessToken = await this.generateAccessToken(email);
        const refreshToken = await this.generateRefreshToken(email);
        return { accessToken, refreshToken };
    }
}
exports.default = AuthenticationRepository;
