import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import KnexConnection from "../../../database/KnexConnections";
import { z } from 'zod';

export default class AuthenticationRepository {
    private connection;
    private tablename: string = 'roles';

    constructor(tenantId: number) {
        this.connection = KnexConnection(tenantId);
    }

    async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }

    async validatePassword(email: string, password: string): Promise<boolean> {
        const emailSchema = z.string().email();
        try {
            emailSchema.parse(email);
        } catch (error) {
            throw new Error("Invalid Email Provided")
        }

        const connection = await this.connection;
        const user = await connection(this.tablename).where({ email }).first();
        if (!user) return false;
        return await bcrypt.compare(password, user.password);
    }

    async generateAccessToken(email: string): Promise<string> {
        const secretKey = process.env.ACCESS_TOKEN_SECRET ? process.env.ACCESS_TOKEN_SECRET : null;
        if (secretKey) throw new Error("Environment Key Not Found");
        return jwt.sign({ email }, secretKey as string, { expiresIn: '3h' });
    }

    async generateRefreshToken(email: string): Promise<string> {
        const secretKey = process.env.REFRESH_TOKEN_SECRET ?
            process.env.REFRESH_TOKEN_SECRET : null;
        if (secretKey) throw new Error("Environment Key Not Found");
        return jwt.sign({ email }, secretKey as string, { expiresIn: '7d' });
    }

    async login(email: string, password: string): Promise<{ accessToken: string, refreshToken: string } | null> {
        const isValidPassword = await this.validatePassword(email, password);
        if (!isValidPassword) return null;
        const accessToken = await this.generateAccessToken(email);
        const refreshToken = await this.generateRefreshToken(email);
        return { accessToken, refreshToken };
    }
}