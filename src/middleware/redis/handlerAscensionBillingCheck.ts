import { Request, Response, NextFunction } from 'express';
import Creator from '../../models/creator/creator';
import User from '../../LobnosAuth/user';
import { OperationsFailures } from '../../models/operations/types';

export const billingIdChecker = (request: Request, response: Response, next: NextFunction) => {
     const { csvid, ptid, target, testid } = request.query;
     const { billingid, patientid } = new Creator(parseInt(testid.toString())).sanitize_patientid_billingid_query(csvid as string, ptid as string, target as string);

     if (!billingid || !patientid) {
          return response.status(400).json({ status: false, message: 'billingid or patientid not found' });
     }

     next();
};


export const handleAuthenticationEmployee = async (
     request: Request<{ billingid: number; employeeid: number; selectedPaymentMode: number }, {}, {}, { tenantId: string }>,
     response: Response,
     next: NextFunction
) => {
     const { employeeid } = request.params;
     const { tenantId } = request.query

     if (!employeeid) {
          return response.status(404).json({ status: "error", message: OperationsFailures.unfoundID });
     }

     if (isNaN(employeeid)) {
          return response.status(400).json({ status: "error", message: OperationsFailures.invalidResponseBodyParams });
     }

     try {
          const role = await new User(null, null, null, null, null).getUserRole(employeeid, parseInt(tenantId));
          if (role !== "admin") {
               return response.status(403).json({ status: "error", message: OperationsFailures.dontHaveAccessPermission });
          }

          (request.query as any).employeeid = parseInt(employeeid.toString());

          next();
     } catch (error) {
          return response.status(500).json({ status: "error", message: OperationsFailures.internalServerError });
     }
};