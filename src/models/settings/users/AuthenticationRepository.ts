import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import KnexConnection from "../../../database/KnexConnections";

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

    async getUserByLoginIdentifier(identifier: string): Promise<any | null> {
        const connection = await this.connection;
        const match = String(identifier || '').trim().match(/^S(\d+)$/i);
        if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0) return null;
        return await connection(this.tablename).where({ employeeid: Number(match[1]) }).first() || null;
    }

    async validatePassword(identifier: string, password: string): Promise<any | null> {
        const user = await this.getUserByLoginIdentifier(identifier);
        if (!user) return null;
        const passwordMatched = await bcrypt.compare(password, user.password);
        return passwordMatched ? user : null;
    }

    async generateAccessToken(email: string, claims: Record<string, unknown> = {}, expiresInSeconds?: number): Promise<string> {
        const secretKey = process.env.ACCESS_TOKEN_SECRET ? process.env.ACCESS_TOKEN_SECRET : null;
        if (!secretKey) throw new Error("Environment Key Not Found");
        if(expiresInSeconds!==undefined&&(!Number.isSafeInteger(expiresInSeconds)||expiresInSeconds<=0||expiresInSeconds>10800))throw new Error('Invalid access token lifetime');
        return jwt.sign({ ...claims, email }, secretKey as string, { expiresIn: expiresInSeconds ?? '3h' });
    }

    async generateRefreshToken(email: string): Promise<string> {
        const secretKey = process.env.REFRESH_TOKEN_SECRET ?
            process.env.REFRESH_TOKEN_SECRET : null;
        if (!secretKey) throw new Error("Environment Key Not Found");
        return jwt.sign({ email }, secretKey as string, { expiresIn: '7d' });
    }

    async login(identifier: string, password: string): Promise<{ accessToken: string, refreshToken: string, user: any } | null> {
        const user = await this.validatePassword(identifier, password);
        if (!user) return null;
        const accessToken = await this.generateAccessToken(user.email);
        const refreshToken = await this.generateRefreshToken(user.email);
        return { accessToken, refreshToken, user };
    }
}
