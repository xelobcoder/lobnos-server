import { testpanel } from "../../testpanel/testpanelList"
import { Request, Response } from "express";
import Creator from "../../models/creator/creator";
import { OperationsFailures } from "../../models/operations/types";
import { responseError, customError } from "../../hooks/helper";
import logger from "../../hooks/logger";

export const getUltrasoundTestListHandler = async function (request: Request, response: Response) {
       try {
              const tenantIdValue = request.query.tenantId;
              if (!tenantIdValue) return customError('tenantId is required', 400, response);
              const tenantId = parseInt(String(tenantIdValue), 10);
              const ultrasoundList = await testpanel.getUltrasoundScanTestList(tenantId);
              response.send(ultrasoundList);
       } catch (err) {
              logger.error(err instanceof Error ? err.message : String(err));
              responseError(response);
       }
}


export const createUltrasoundTemplateHandler = async function (request: Request, response: Response) {
       try {
              const { fields, employeeid, visibleToAll, associatedbodypart, name, testid } = request.body;
              const parsedVisibleToAll = parseInt(visibleToAll.toString());

              if (!associatedbodypart) return customError(OperationsFailures.invalidResponseBodyParams + ' .Associated body part not included', 404, response);

              const isValidBodyPart = fields && employeeid && (parsedVisibleToAll == 0 || parsedVisibleToAll == 1) && associatedbodypart && testid && typeof testid == 'number' && Array.isArray(fields) && name;

              if (!isValidBodyPart) {
                     return customError(OperationsFailures.invalidResponseBodyParams, 400, response);
              }
              const tenantIdValue = request.query.tenantId;
              if (!tenantIdValue) return customError('tenantId is required', 400, response);
              const tenantId = parseInt(String(tenantIdValue), 10);
              const isCreated_Value = await Creator.createUltrasoundTemplate(tenantId, request.body);
              response.send({ status: isCreated_Value });
       } catch (err) {
              responseError(response);
       }
}



export const getUltrasoundTemplateSingleDetailHandler = async function (request: Request, response: Response) {
       try {
              const { templateid } = request.query;
              const tenantIdValue = request.query.tenantId;
              if (!templateid || !tenantIdValue) return customError('templateid and tenantId are required', 400, response);
              const parsedTemplateId = parseInt(String(templateid), 10);
              const tenantId = parseInt(String(tenantIdValue), 10);
              const templateDetail = await Creator.getUltrasoundTemplateSingleDetail(tenantId, parsedTemplateId);
              response.send(templateDetail);
       } catch (err) {
              responseError(response);
       }
}


export const updateUltrasoundTemplateHandler = async function (request: Request, response: Response) {
       try {
              const { fields, employeeid, visibleToAll, associatedbodypart, name, testid } = request.body;

              const isValidBodyPart = fields && employeeid && (visibleToAll == 0 || visibleToAll == 1) && associatedbodypart && testid && typeof testid == 'number' && Array.isArray(fields) && name;

              if (!isValidBodyPart) {
                     return customError(OperationsFailures.invalidResponseBodyParams, 400, response);
              }
              const tenantIdValue = request.query.tenantId;
              if (!tenantIdValue) return customError('tenantId is required', 400, response);
              const tenantId = parseInt(String(tenantIdValue), 10);
              const isCreated_Value = await Creator.updateUltrasoundTemplate(tenantId, request.body);

              response.send({ status: isCreated_Value });
       } catch (err) {
              responseError(response);
       }
}


export const getUltrasoundScanTestListHandler = async function (request: Request<
       {}, {}, {}, {
              count: string,
              page: string,
              employeeid: string,
              testid: string,
              tenantId: number
       }>, response: Response) {
       try {
              const { count, page, employeeid, testid } = request.query;
              const isValidQuery = count && page && employeeid
                     && typeof count == 'string' && typeof page == 'string' && typeof employeeid == 'string'

              if (isValidQuery) {
                     let parsedTestId;
                     if (testid) {
                            parsedTestId = parseInt(testid.toString());
                     }
                     const tenantId = parseInt(request.query.tenantId.toString())
                     if (testid && parsedTestId !== undefined && !isNaN(parsedTestId)) {
                            const list = await Creator.getUltrasoundTypeTemplates(tenantId, parsedTestId, parseInt(count.toString()), parseInt(page.toString()), parseInt(employeeid.toString()));
                            response.send(list);
                     }
                     else {
                            const list = await Creator.getUltrasoundTemplatesAll(tenantId, parseInt(count.toString()), parseInt(page.toString()), parseInt(employeeid.toString()));
                            response.send(list);
                     }
              } else {
                     return customError(OperationsFailures.invalidResquestQuery, 400, response);
              }


       } catch (err) {
              console.log(err)
              responseError(response);
       }
} 