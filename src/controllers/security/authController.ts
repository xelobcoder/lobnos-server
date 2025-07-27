import { Request, Response } from 'express';
import AuthenticationRepository from '../../models/settings/users/AuthenticationRepository';
import TokenValidator from '../../models/settings/users/TokenValidator';
import RolesRepository from '../../models/settings/users/RolesRepository';
import { customError } from '../../hooks/helper';

export class AuthController {
    private authRepo: AuthenticationRepository;
    private tokenValidator: TokenValidator;

    constructor() {
        this.tokenValidator = new TokenValidator();
    }

    private getTenantId(req: Request): number {
        const tenantId = parseInt(req.query.tenantId as string, 10);
        if (isNaN(tenantId)) {
            throw new Error('Invalid tenantId');
        }
        return tenantId;
    }

    public async login(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = this.getTenantId(req);
            this.authRepo = new AuthenticationRepository(tenantId);

            const { email, password } = req.body;
            const tokens = await this.authRepo.login(email, password);
            if (!tokens) {
                const message = 'Invalid email or password'
                res.status(401).json({ status: false, error: message });
                return;
            }
            const user = await new RolesRepository(tenantId).getRoleByEmail(email);
            const { role, username, employeeid } = user;
            res.status(200).json({ status: true, accessToken: tokens.accessToken, user: { role, employeeid, username, email } });
        } catch (error) {
            console.log(error)
            res.status(400).json({ message: error.message });
        }
    }

    public async validateToken(req: Request, res: Response): Promise<void> {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            res.status(401).json({ message: 'Token not provided' });
            return;
        }

        const isValid = await this.tokenValidator.validateAccessToken(token);
        if (!isValid) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }

        res.status(200).json({ message: 'Token is valid' });
    }

    async validateUserPinProvided(req: Request<{}, {}, {}, { employeeid: string | number, tenantId: number, pin: string | number }>, res: Response) {
        try {
            const { employeeid, pin, tenantId } = req.query;
            if (!employeeid || !pin) {
                return customError('employeeid and pin are required', 400, res);
            }

            const pEmployeeid = parseInt(employeeid.toString());
            const pPin = parseInt(pin.toString());
            if (isNaN(pEmployeeid) || isNaN(pPin)) {
                return customError('employeeid and pin must be numbers', 400, res);
            }

            const rolesRepo = await new RolesRepository(tenantId).validatePin(pEmployeeid, pPin);
            if (rolesRepo) {
                res.status(200).json({ status: true, message: 'Pin is valid' });
            } else {
                res.status(401).json({ status: false, message: 'Invalid pin' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ status: false, message: 'Internal server error' });
        }
    }
}