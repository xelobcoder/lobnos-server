import { expect, it, vi } from 'vitest';
vi.mock('./logger', () => ({ default: { error: vi.fn() } }));
vi.mock('../database/connection', () => ({ databaseConnectionPool: {} }));
vi.mock('../models/Tenancy/tenantConnections', () => ({ primeTenancyConnector: {} }));
vi.mock('./configuration', () => ({ configuration: {} }));
import { responseError } from './helper';

it('does not disclose SQL or driver messages in server-error responses', () => {
    const response: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    responseError(response, new Error('SELECT private_patient_record FROM tenant_database: password=secret'));
    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.send.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).not.toMatch(/SELECT|patient_record|tenant_database|secret/);
});
it('retains an explicit client-error contract with the matching HTTP and payload status', () => {
    const response: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    responseError(response, 'Review the latest result before validating', 409);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.send).toHaveBeenCalledWith({ status: 'error', statusCode: 409, message: 'Review the latest result before validating' });
});
