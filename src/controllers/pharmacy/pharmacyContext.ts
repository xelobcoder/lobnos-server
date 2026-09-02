import { Request } from 'express';

export const tenantOf = (request: Request): number => Number((request as any).authUser.tenantId);
export const actorOf = (request: Request): number => Number((request as any).authUser.employeeid);
export const roleOf = (request: Request): string => String((request as any).authUser?.role || '').toLowerCase();
