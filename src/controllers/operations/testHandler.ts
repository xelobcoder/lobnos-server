import { testpanel } from "../../testpanel/testpanelList"
import { Request, Response } from "express";
import Creator from "../../models/creator/creator";
import { OperationsFailures } from "../../models/operations/types";
import { responseError, customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { getAuthUser } from "../../middleware/authority";
import { roleAllowed } from "../../middleware/roles";
import { PrimeSqlErrorHandler } from "../../hooks/utility";
import { ultrasoundTemplateSchema, UltrasoundTemplateRepository } from "../../models/operations/imaging/UltrasoundTemplateRepository";

function templateMutationContext(request: Request, response: Response) {
       const value = request.query.tenantId;
       const tenantId = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
       if (!Number.isSafeInteger(tenantId)) {
              customError('Invalid tenantId', 400, response);
              return null;
       }
       const actor = getAuthUser(request);
       if (!actor) {
              customError('Authentication required', 401, response);
              return null;
       }
       if (['clinician', 'patient'].includes(String(actor.role || '').toLowerCase())) {
              customError('Portal sessions cannot manage ultrasound templates', 403, response);
              return null;
       }
       if (Number(actor.tenantId) !== tenantId) {
              customError('Template tenant access denied', 403, response);
              return null;
       }
       return { tenantId, actor };
}

function templateMutationError(error: unknown, response: Response) {
       const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
              && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'TEMPLATE_MUTATION_FAILED';
       logger.error('Ultrasound template operation failed', { code });
       return PrimeSqlErrorHandler.handleError(error, response);
}

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
              const context = templateMutationContext(request, response);
              if (!context) return;
              const parsed = ultrasoundTemplateSchema.safeParse({ ...request.body, employeeid: context.actor.employeeid });
              if (!parsed.success) return customError('Invalid ultrasound template: check the name, body part and report fields', 400, response);
              const created = await Creator.createUltrasoundTemplate(context.tenantId, parsed.data);
              if (!created) return customError('Ultrasound template could not be created', 500, response);
              response.send({ status: true });
       } catch (err) {
              templateMutationError(err, response);
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
              if (!templateDetail) return customError('Ultrasound template not found', 404, response);
              response.send(templateDetail);
       } catch (err) {
              responseError(response);
       }
}


export const updateUltrasoundTemplateHandler = async function (request: Request, response: Response) {
       try {
              const context = templateMutationContext(request, response);
              if (!context) return;
              const parsed = ultrasoundTemplateSchema.safeParse({ ...request.body, employeeid: context.actor.employeeid });
              if (!parsed.success || !parsed.data.keyid) return customError('Invalid ultrasound template or template ID', 400, response);
              const updated = await Creator.updateUltrasoundTemplate(context.tenantId, { ...parsed.data, keyid: parsed.data.keyid });
              if (!updated) return customError('Ultrasound template not found', 404, response);
              response.send({ status: true });
       } catch (err) {
              templateMutationError(err, response);
       }
}

export const deleteUltrasoundTemplateHandler = async function (request: Request, response: Response) {
       try {
              const context = templateMutationContext(request, response);
              if (!context) return;
              const id = request.params.templateid;
              const templateId = typeof id === 'string' && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
              if (!Number.isSafeInteger(templateId)) return customError('Invalid template ID', 400, response);
              const result = await new UltrasoundTemplateRepository(context.tenantId).delete(
                     templateId, context.actor.employeeid, roleAllowed(context.actor.role, ['admin', 'manager']),
              );
              if (result === 'not_found') return customError('Ultrasound template not found', 404, response);
              if (result === 'forbidden') return customError('Only the template creator or an administrator/manager can delete this template', 403, response);
              logger.info('Ultrasound template deleted', { tenantId: context.tenantId, templateId, employeeId: context.actor.employeeid });
              response.send({ status: 'success', result: { deleted: true, templateId } });
       } catch (err) {
              templateMutationError(err, response);
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