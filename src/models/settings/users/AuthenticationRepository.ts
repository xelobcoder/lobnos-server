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
        const loginIdentifier = String(identifier || '').trim();
        if (!loginIdentifier) return null;
        const hasLoginUsername = await connection.schema.hasColumn(this.tablename, 'login_username');
        const query = connection(this.tablename).where({ email: loginIdentifier });
        if (hasLoginUsername) {
            query.orWhere({ login_username: loginIdentifier });
        }
        query.orWhere({ username: loginIdentifier });
        return await query.first() || null;
    }

    async validatePassword(identifier: string, password: string): Promise<any | null> {
        const user = await this.getUserByLoginIdentifier(identifier);
        if (!user) return null;
        const passwordMatched = await bcrypt.compare(password, user.password);
        return passwordMatched ? user : null;
    }

    async generateAccessToken(email: string, claims: Record<string, unknown> = {}): Promise<string> {
        const secretKey = process.env.ACCESS_TOKEN_SECRET ? process.env.ACCESS_TOKEN_SECRET : null;
        if (!secretKey) throw new Error("Environment Key Not Found");
        return jwt.sign({ ...claims, email }, secretKey as string, { expiresIn: '3h' });
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