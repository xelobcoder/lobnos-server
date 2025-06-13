import { Request, Response } from "express";
import { customError, responseError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import Patient from "../../models/patients/patientAnalytics"
import { UpdateCredentialsRequest } from "../../models/patients/types";
export const getTransactionsByDateHandler = async (request: Request<{}, {}, {}, {
     patientid?: number;
     from?: string;
     tenantId: string;
     to?: string;
}>, response: Response): Promise<void> => {
     const { patientid, from, to, tenantId } = request.query;

     if (!patientid) {
          return customError("Patient ID not provided", 401, response);
     }
     const init = new Patient(patientid);

     try {
          const tenantIdNum = parseInt(tenantId, 10);
          const data = await init.getTransactionsByDate(tenantIdNum, patientid, from, to);
          if (Array.isArray(data)) {
               response.status(200).send({ result: data, statusCode: 200, status: "success" });
          } else {
               customError(data, 401, response);
          }
     } catch (err: any) {
          logger.error(err);
          customError(err.message, 500, response);
     }
};

export const updateCredentialsHandler = async (request: Request<{}, {}, UpdateCredentialsRequest, {
     patientid: string,
     tenantId: string
}>, response: Response): Promise<void> => {
     try {
          const { patientid } = request.body;
          const { tenantId } = request.query;
          if (!patientid) {
               throw new Error("Patient ID is required");
          }
          const parsedPatientId = parseInt(patientid.toString(), 10);
          const parsedTenantId = parseInt(tenantId.toString(), 10);
          const status = await new Patient(parsedPatientId).updateCredentials(parsedTenantId, request.body);
          const message = status ? "patient credentials updated successfully" : "patient credentials not updated";
          const statusCode = status ? 200 : 401;
          const statusMessage = status ? "success" : "failed";
          response.send({
               message,
               statusCode,
               status: statusMessage
          });
     } catch (err) {
          logger.error(err)
          responseError(response, err);
     }
};


export const updateNotificationSettingsHandler = async (request: Request<{}, {}, {
     patientid: number, mode: string, method: string, notify: boolean
}, { tenantId: string }>, response: Response): Promise<void> => {
     try {
          const { patientid, mode, method, notify } = request.body
          if (mode && method && notify && patientid) {
               return customError(`mode of result, method of delivery and notification settings required`, 404, response);
          }
          const tenantId = parseInt(request.query.tenantId)
          const status = await new Patient(patientid).updateNotificationSettings(tenantId, request.body);
          const message = status ? "patient settings updated successfully" : "patient settings not updated";
          const statusCode = status ? 200 : 401;
          const statusMessage = status ? "success" : "failed";
          response.send({
               message,
               statusCode,
               status: statusMessage
          });
     } catch (err) {
          responseError(response)
     }
};



export const getNotificationSettingsHandler = async (request: Request<{}, {}, {}, {
     patientid: string,
     tenantId: string
}>, response: Response): Promise<void> => {
     try {
          const { tenantId, patientid } = request.query;
          if (!patientid) {
               throw new Error("Patient ID is required");
          }
          const parsedPatientId = parseInt(patientid.toString(), 10);
          const parsedTenantId = parseInt(tenantId.toString(), 10);
          const notications = await new Patient(parsedPatientId).getPatientNotificationSettings(parsedTenantId, parsedPatientId);
          response.send(notications);
     } catch (err) {
          responseError(response, err)
     }
}


export const updatePatientImageHandler = async (request: Request<{}, {}, {}, {
     patientid: string,
     tenantId: string,
     savedFilename: string
}>, response: Response) => {
     try {
          const { patientid, tenantId, savedFilename } = request.query;
          if (!patientid) {
               throw new Error("Patient ID is required");
          }
          if (!savedFilename) {
               throw new Error("No file uploaded");
          }

          const parsedPatientId = parseInt(patientid, 10);
          const parsedTenantId = parseInt(tenantId, 10);

          const status = await new Patient(parsedPatientId).updatePatientImage(
               parsedTenantId,
               parsedPatientId,
               savedFilename
          );

          const statusState = status ? 'success' : 'error';
          const statusMessage = status ? 'Patient image updated successfully' : 'Patient image update failed'
          response.status(200).json({
               status: statusState,
               message: statusMessage,
               imagePath: savedFilename
          });
     } catch (err) {
          responseError(response, err)
     }
}