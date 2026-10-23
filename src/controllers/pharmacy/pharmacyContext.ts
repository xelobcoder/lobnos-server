import { Request } from 'express';

export const tenantOf = (request: Request): number => Number((request as any).authUser.tenantId);
export const actorOf = (request: Request): number => Number((request as any).authUser.employeeid);
export const branchOf = (request: Request): number | null => (request as any).authUser.branch == null ? null : Number((request as any).authUser.branch);
export const roleOf = (request: Request): string => String((request as any).authUser?.role || '').toLowerCase();
