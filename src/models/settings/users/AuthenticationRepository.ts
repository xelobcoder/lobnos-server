import { requireStrongPassword } from '../../auth/PasswordPolicy';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import KnexConnection from "../../../database/KnexConnections";
import { ensureLoginAttemptSecurity, verifyStaffPassword, LoginCooldownError } from '../../auth/LoginAttemptSecurity';
import { revokePasswordSessions } from '../../auth/passwordSessions';

export default class AuthenticationRepository {
    private connection;
    private tablename: string = 'roles';

    constructor(tenantId: number) {
        this.connection = KnexConnection(tenantId);
    }

    async hashPassword(password: string): Promise<string> {
        requireStrongPassword(password);
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
        const match = String(identifier || '').trim().match(/^S(\d+)$/i);
        if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0 || typeof password !== 'string' || !password) return null;
        const connection = await this.connection;
        await ensureLoginAttemptSecurity(connection);
        const result = await connection.transaction(async trx => {
            const user = await trx('roles').where({ employeeid: Number(match[1]) }).forUpdate().first();
            if (!user || Number(user.platform_support) === 1) return { user: null, retryAfter: undefined };
            const attempt = await verifyStaffPassword(trx, Number(user.employeeid), () => bcrypt.compare(password, user.password));
            return { user: attempt.matched ? user : null, retryAfter: attempt.retryAfter };
        });
        // Throw after commit so failed attempts survive the rejected login.
        if (result.retryAfter) throw new LoginCooldownError(result.retryAfter);
        return result.user;
    }

    async changePassword(employeeid: number, currentPassword: string, newPassword: string): Promise<void> {
        const validNewPassword = requireStrongPassword(newPassword);
        const connection = await this.connection;
        await connection.transaction(async trx => {
            const user = await trx('roles').where({ employeeid }).forUpdate().first();
            if (!user || Number(user.platform_support) === 1) {
                throw Object.assign(new Error('Staff account not found'), { statusCode: 404 });
            }
            if (typeof currentPassword !== 'string' || !currentPassword ||
                !(await bcrypt.compare(currentPassword, String(user.password || '')))) {
                throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });
            }
            if (await bcrypt.compare(validNewPassword, String(user.password || ''))) {
                throw Object.assign(new Error('Choose a password you have not used before'), { statusCode: 400 });
            }

            const changedOn = new Date();
            await trx('roles').where({ employeeid }).update({
                password: await bcrypt.hash(validNewPassword, 10),
                password_changed_on: changedOn,
                updated_on: changedOn,
            });
            await revokePasswordSessions(trx, 'staff', employeeid);
        });
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
