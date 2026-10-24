import { describe, expect, it, vi } from 'vitest';
import { pharmacyModuleBoundary, pharmacyRouteAllowed } from './pharmacyModuleBoundary';
import { pharmacyAccess, pharmacyReversalAccess, pharmacySalesAccess, pharmacyStockAccess, pharmacyCatalogueAccess, pharmacyFinanceAccess, pharmacyAdministratorAccess } from '../controllers/pharmacy/pharmacyAccess.middleware';

describe('pharmacy access boundaries', () => {
     it.each(['/api/v1/inventory/items', '/api/v1/accounting/reports/trial-balance', '/api/v1/billing/transactions', '/api/v1/application/filtering/table/roles', '/api/v1/settings/users'])('denies pharmacy access to %s', path => { expect(pharmacyRouteAllowed('GET', path)).toBe(false); });
     it.each(['/api/v1/pharmacy/sales', '/api/v1/prescriptions/rx/fulfill', '/api/v1/pharmacy/management/setup'])('allows pharmacy module routing for %s', path => { expect(pharmacyRouteAllowed('POST', path)).toBe(true); });
     it('permits self account services while rejecting a settings write', () => {
          expect(pharmacyRouteAllowed('GET', '/api/v1/applicationsettings')).toBe(true);
          expect(pharmacyRouteAllowed('POST', '/api/v1/applicationsettings')).toBe(false);
     });
     function invoke(middleware: any, role: string, path = '/api/v1/pharmacy/sales') {
          const next = vi.fn(), res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
          middleware({ method: 'POST', originalUrl: path, authUser: { role } }, res, next); return { next, res };
     }
     it('rejects a lab manager and permits a pharmacy manager', () => {
          expect(invoke(pharmacyAccess, 'manager').next).not.toHaveBeenCalled();
          expect(invoke(pharmacyAccess, 'pharmacy_manager').next).toHaveBeenCalledOnce();
          expect(invoke(pharmacyReversalAccess, 'manager').next).not.toHaveBeenCalled();
     });
     it('allows a prescribing clinician to browse medicines without granting a lab manager pharmacy access', () => {
          expect(invoke(pharmacyCatalogueAccess, 'clinician').next).toHaveBeenCalledOnce();
          expect(invoke(pharmacyCatalogueAccess, 'manager').next).not.toHaveBeenCalled();
     });
     it('does not grant cashier stock management or storekeeper selling authority', () => {
          expect(invoke(pharmacyStockAccess, 'pharmacy_cashier').next).not.toHaveBeenCalled();
          expect(invoke(pharmacySalesAccess, 'pharmacy_storekeeper').next).not.toHaveBeenCalled();
          expect(invoke(pharmacySalesAccess, 'pharmacy_cashier').next).toHaveBeenCalledOnce();
     });
     it.each(['admin', 'Admin', 'super-admin', 'super_admin'])('allows administrator role %s to manage the pharmacy financial day', role => {
          expect(invoke(pharmacyFinanceAccess, role, '/api/v1/pharmacy/management/open-day').next).toHaveBeenCalledOnce();
     });
     it('reserves financial-day reopening for organisation administrators', () => {
          expect(invoke(pharmacyAdministratorAccess, 'admin', '/api/v1/pharmacy/management/reopen-day').next).toHaveBeenCalledOnce();
          expect(invoke(pharmacyAdministratorAccess, 'super-admin', '/api/v1/pharmacy/management/reopen-day').next).toHaveBeenCalledOnce();
          expect(invoke(pharmacyAdministratorAccess, 'pharmacy_manager', '/api/v1/pharmacy/management/reopen-day').next).not.toHaveBeenCalled();
          expect(invoke(pharmacyAdministratorAccess, 'pharmacy_accountant', '/api/v1/pharmacy/management/reopen-day').next).not.toHaveBeenCalled();
     });
     it('restricts pharmacy sessions globally but keeps organisation administrator access', () => {
          expect(invoke(pharmacyModuleBoundary, 'Pharmacy Manager', '/api/v1/inventory/items').next).not.toHaveBeenCalled();
          expect(invoke(pharmacyModuleBoundary, 'admin', '/api/v1/inventory/items').next).toHaveBeenCalledOnce();
     });
});
