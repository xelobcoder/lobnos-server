import { assertCriticalRelease } from '../../models/operations/CriticalActionService';
import { getAuthUser } from '../../middleware/authority';
import { Request, Response } from "express";
import { OperationsFailures, validatorsFinalFormatType } from "../../models/operations/types";
import ResultSettings from "../../models/application/appsettings/result-settings/resultSettings";
import TestReportSettings from "../../models/application/appsettings/result-settings/TestReportSettings";
import { ApplicationResultSettings } from "../../models/application/appsettings/interfaces/results-settings.interface";
import { companyInfo, getAllCompanyProfiles } from "../../models/settings/companyProfile";
import Registration from "../../models/registration/registration";
import { NewRegistration } from "../../models/registration/types";
// import TestSetup from '../../../api/models/testSetup.model'
import ResultPrint from "../../models/result/resultPrint";
import { TestAscension } from "../../models/operations/ascension";
import { customError, responseError } from "../../hooks/helper";
import { CreationRule, previewReportView, resultEntryType } from "../../models/creator/creator-types";
import resultEncrptionReferer from "../../models/creator/resultEncryptionReferer";
import Creator from "../../models/creator/creator";
import { Billing } from "../../../obso/billing";
import { PrimeLimsTabletest_ascension, PrimeLimsTabletest_panels } from "../../database/DatabaseTableSchema";
import TestCreationRulesRepository from "../../models/TestCreation/TestCreationRulesRepository";
import { testAscensionTableTypes } from "../../models/billing/billingclientTypes";
import RolesRepository, { IEmployee } from "../../models/settings/users/RolesRepository";
import { TestDetailCategoryType } from "../../models/operations/testFieldsCategoryClass";
import RequestAccess from "../../models/security/RequestAcessResult/requestAcess";
import { Services } from "../../models/services/services";
import KnexConnection from "../../database/KnexConnections";
import ResultDeliveryClass from "./resultDelivery";
import { InAppNotificationService } from "../../models/application/in-app-notifications/InAppNotificationService";
import LoggingCriticalValueAlertRepository from "../../models/creator/Repo/loggingCriticalValueAlertRepository";
import { roleAllowed, normalizeRole } from "../../middleware/roles";
import { assertLabTestAccess } from "../../models/operations/LabAccessPolicy";
import { loadReleasedLaboratoryReport } from "../../models/result/LaboratoryReportData";
import { testpanel } from "../../testpanel/testpanelList";
import logger from "../../hooks/logger";

// export const getPatientTestTrend = async (req: Request, res: IResponse): Promise<void> => {
//   const { patientid, testid, test, instances } = req.query;
//   try {
//     const result = await new Patient(patientid).getPatientTestTrend(patientid, testid, test, instances);
//     res.send({ statusCode: 200, status: "success", result });
//   } catch (err) {
//     logger.error(err);
//     customError("Error occurred", 500, res);
//   }
// };

export const resultEntry = async (req: Request, response: Response): Promise<void> => {
	try {
		const { tenantId } = req.query
		const { testid } = req.body;
		if (isNaN(testid)) return customError("testid must be a number", 400, response);
		const tenantIdP = parseInt(tenantId.toString())

		const creator = new Creator(testid);
		const isDataInserted = await creator.resultEntry(tenantIdP, req.body as unknown as resultEntryType);
		if (isDataInserted == true) {
			const body = req.body as any;
			const ascensionId = body?.ascensionid || body?.ascensionId;
			const actorId = body?.employeeid ? Number(body.employeeid) : undefined;
			if (ascensionId && creator.resultSaveChanged) {
				InAppNotificationService.publish(tenantIdP, {
					eventCode: 'RESULT_ENTERED',
					module: 'result',
					title: 'Result entered',
					message: `Result data was entered for ascension #${ascensionId} and is awaiting validation.`,
					referenceType: 'ascension',
					referenceId: Number(ascensionId),
					actorEmployeeId: actorId,
				}).catch(() => { });
			}
			const connection = await KnexConnection(tenantIdP);
               const approval = await connection('dbotestresultapproval').where({ ascensionid: Number(ascensionId) }).first();
               const requiresRevalidation = Number(approval?.requires_revalidation) === 1;
               response.send({ status: 'success', statusCode: 200, changed: creator.resultSaveChanged, replayed: creator.resultSaveReplayed, requires_revalidation: requiresRevalidation, approval_revision: Number(approval?.approval_revision || 0), message: creator.resultSaveReplayed ? 'This save was already committed. No values were reapplied; reload to review the current result.' : requiresRevalidation ? 'Results saved. Previous validation was invalidated; validate this revision again before release.' : 'Results saved successfully' });
		} else {
			response.send({ status: "failed", statusCode: 404, message: "error occured saving results" });
		}
	} catch (err) {
		const statusCode = Number((err as any)?.statusCode);
		if ((err as any)?.code === 'RESULT_SAVE_SCHEMA_REQUIRED') {
			logger.error('[Result entry] Tenant result-save schema is unavailable; verify tenant startup bootstrap completed.', { code: 'RESULT_SAVE_SCHEMA_REQUIRED' });
		}
		if ((statusCode >= 400 && statusCode < 500) || (statusCode === 503 && (err as any)?.code === 'RESULT_SAVE_SCHEMA_REQUIRED')) {
			response.status(statusCode).send({ status: 'error', statusCode, code: (err as any)?.code, message: (err as any)?.message || 'Result entry was rejected' });
			return;
		}
		responseError(response, err);
	}
};



export const getPreviousResultEntryRecordsIfAny = async function (request: Request<{}, {}, {}, { csvid: string, ptid: string, testid: string, target?: string, tenantId: string }>, response: Response) {
	try {
		const { csvid, ptid, testid, target = '70,50', tenantId } = request.query;
		if (!csvid || !ptid) return customError("required params are missing", 400, response)
		const parsedTestId = parseInt(testid.toString());
		const rule = new Creator(parsedTestId);

		const tenantIdP = parseInt(tenantId.toString())
		const { billingid, patientid } = rule.sanitize_patientid_billingid_query(csvid as any, ptid as any, target as any);

		if (patientid && billingid && testid) {
			const records = await rule.getResultEntryRecords(tenantIdP, parsedTestId, billingid, patientid);
			if (typeof records !== "string") {
				let result = records?.result;
				const decryptedResult = await resultEncrptionReferer(result as any, "decryption");
				if (decryptedResult != undefined) {
					const resultDeliveryPreference = await new ResultDeliveryClass(billingid, tenantIdP).getResultDeliveryForTransaction();
					const { resources } = decryptedResult;
					if (resources && Array.isArray(resources) && resources.length > 0) {
						result = result.map((item: any, index: number) => {
							return { ...item, value: resources[index]['value'] }
						})
						return response.send({ ...records, result, resultDeliveryPreference });
					}
				}
				return response.send(records)
			} else {
				response.send({ records: null })
			}
		}
		response.send([])
	} catch (err) {
		responseError(response)
	}
}


export const getResultCommentsHandler = async function (request: Request<{}, {}, {}, { csvid: string, testid: string, ptid: string, tenantId: string }>, response: Response) {
	try {
		const { csvid, testid, ptid, tenantId } = request.query
		if (!csvid || !testid || !ptid) {
			return customError("testid,patientid and billingid are required", 404, response);
		}

		const tenantIdP = parseInt(tenantId.toString())
		const parsedTestid = parseInt(testid.toString());
		const creator = new Creator(parsedTestid);

		const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid as string, ptid as string, '70,50');
		const parsedBillingid = parseInt(billingid.toString());
		const comments = await creator.getCustomCommentsRecords(tenantIdP, parsedBillingid, parsedTestid);
		response.send({ comments })
	} catch (err) {
		responseError(response)
	}
}



export const testCreationRuleUpdateHandler = async (request: Request<{}, {}, { testid: number, data: any[] }, { tenantId: number }>, response: Response) => {
	try {
		const { testid, data } = request.body
		const { tenantId } = request.query

		const parsedTestId = parseInt(testid.toString());
		if (!testid || !data)
			return customError("testid  && data is required", 404, response)
		if (data.length === 0)
			return customError("wrong format provided", 404, response)
		const tenantIdP = parseInt(tenantId.toString())

		const createFields: number[] = await new TestCreationRulesRepository(tenantIdP).create(data, parsedTestId);
		const status = createFields.length > 0 ? true : false
		response.send({ status, message: status ? "fields created successfully" : "error occured creating fields" })
	} catch (err) {
		responseError(response)
	}
}



export const criticalValuesUnseenHandler = async (request: Request<{}, {}, {}, { count?: string, page?: string, tenantId?: string, sortby?: string }>, response: Response) => {
	try {
		const { count, page, tenantId } = request.query;
		if (!tenantId) {
			return response.status(400).send({ error: 'tenantId is required' });
		}

		const tenantIdP = parseInt(tenantId.toString())
		const parsedCount = parseInt(count?.toString() || '10');
		const parsedPage = parseInt(page?.toString() || '1');
		const sortby = request.query.sortby === 'ASC' ? 'ASC' : 'DESC';
		const repo = new LoggingCriticalValueAlertRepository(tenantIdP);
		const result = await repo.findUnseenPaginated(parsedPage, parsedCount, sortby);
		response.send(result);
	} catch (err) {
		responseError(response);
	}
}


export const resultEntryDrugsHandler = async (request: Request<{}, {}, {}, { ascensionid: string, testid: string, tenantId: string }>, response: Response) => {
	try {
		const { ascensionid, testid, tenantId } = request.query;

		const tenantIdP = parseInt(tenantId.toString())

		const parsedAscensionid = parseFloat(ascensionid.toString());
		const parsedTestid = parseFloat(testid.toString());

		const drugsList = await TestAscension.getAscensionSavedDrugs(tenantIdP, parsedAscensionid, parsedTestid);
		response.send(drugsList);
	}
	catch (err) {
		responseError(response);
	}
}


export const CheckPaymentStatus = async (request: Request<{}, {}, {}, { ascensionId: string, tenantId: string }>, response: Response, next: Function) => {
	const { ascensionId, tenantId } = request.query;
	try {
		const tenantIdP = parseInt(tenantId.toString())
		const numAscensionId = parseInt(ascensionId.toString());
		const isPaymentStatusValid = await new Creator(0).canPrintResult(tenantIdP, numAscensionId);
		if (!isPaymentStatusValid) {
			return customError("Cannot Print Result For Unpaid Service or test", 403, response);
		} else {
			next()
		}
	} catch (err) {
		responseError(response, err);

	}

}

export const CheckMultiplePaymentStatus = async (request: Request<{}, {}, {}, { ascensionId: string, tenantId: string }>, response: Response, next: Function) => {
	try {
		const { ascensionId, tenantId } = request.query;
		if (!ascensionId || !tenantId) return customError("ascensionId and tenantId are required", 400, response);
		const tenantIdP = parseInt(tenantId.toString(), 10);
		const firstAscensionId = parseInt(ascensionId.toString(), 10);
		if (Number.isNaN(tenantIdP) || Number.isNaN(firstAscensionId)) return customError("Invalid payment check parameters", 400, response);

		const billingid = await new Creator(0).getBillingIdByAscensionId(tenantIdP, firstAscensionId);
		if (!billingid) return customError("Billing record not found", 404, response);
		next();
	} catch (err) {
		responseError(response, err);
	}
};

export const getResultPrintoutHandler = async (request: Request<
	{}, {}, {},
	{
		isScan: boolean,
		ascensionId: number, testid: number,
		csvid: string,
		ptid: string,
		target: string,
		employeeid: string,
		tenantId: string,
		isBrowserPrintout?: number | string
	}
>, response: Response) => {
	try {

		// check if access to view is allowed
		const { ascensionId, testid, csvid, ptid, target, isScan = false, tenantId, isBrowserPrintout } = request.query;
          const actor = getAuthUser(request);
          if (!actor) return customError("Authentication required", 401, response);
          if (Number(tenantId) !== actor.tenantId) return customError("Organization scope does not match the session", 403, response);
          const employeeid = String(actor.employeeid);
		const browserMode = isBrowserPrintout == "1" || isBrowserPrintout == 1 || isBrowserPrintout == "true" ? true : false;
		const tenantIdP = parseInt(tenantId.toString())
		let isWithinWindow = false;

		if (!ascensionId) return customError(OperationsFailures.invalidResquestQuery + ". ascensionid not provided", 404, response);
		const numAscensionId = parseInt(ascensionId.toString());
          if (normalizeRole(actor.role) === "scientist") await assertLabTestAccess(await KnexConnection(tenantIdP), actor, numAscensionId);

		if (!roleAllowed(actor.role, ['admin', 'manager', 'crm'])) {
			isWithinWindow = await RequestAccess.verifyWindowPeriod(tenantIdP, ascensionId, parseInt(employeeid), "access");
		} else {
			isWithinWindow = true
		}
		if (!isWithinWindow) {
			return customError(OperationsFailures.accessWindowExpired, 403, response);
		}
		const resultApproved = await ResultSettings.isApprovalLimitReached(tenantIdP, null, numAscensionId as any, "minimum");
		const releaseApproval = await (await KnexConnection(tenantIdP))('dbotestresultapproval').where({ ascensionid: numAscensionId }).first();
          if (Number(releaseApproval?.requires_revalidation) === 1) return response.status(409).send({ message: 'This result was amended and requires revalidation before release.' });
		if (!resultApproved) {
			return response.send({ message: OperationsFailures.minimumResultValidation })
		}


		const parsedTestId = parseInt(testid.toString());
		const isUltrasoundPrint = String(isScan).toLowerCase() === "true";
		if (!isUltrasoundPrint && await testpanel.isTestUltrasoundScanCategory(tenantIdP, parsedTestId)) {
			return response.status(409).send({
				status: false,
				message: "Ultrasound reports must be printed through the ultrasound report view",
			});
		}
		let creator = new Creator(parsedTestId);
		const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid, ptid, target);

		const dataset = await loadReleasedLaboratoryReport(
			tenantIdP, Number(patientid), Number(billingid), parsedTestId, numAscensionId, browserMode,
		);

		if (employeeid) {
			const pEmployeeId = parseInt(employeeid.toString());
			const employeedata = await new RolesRepository(tenantIdP).getRoleById(pEmployeeId);
			const { username, role, mobile } = employeedata as IEmployee;
			dataset.generalValidation = {
				employeeid: pEmployeeId,
				username,
				role,
				mobile
			}
		}

		response.send(dataset)
	} catch (err: any) {
          if (err?.statusCode) return response.status(err.statusCode).send({ status: 'error', message: err.message });
		console.log(err)
		responseError(response);
	}
}



export const getResultPrintMultipleHandler = async (request: Request<{}, {}, {}, { csvid: string, ptid: string, target: string, employeeid: number | string, isBrowserPrintout: number | string, isUltrasoundInclusive: boolean, tenantId: string }>, response: Response) => {
	try {
		const { csvid, ptid, target, isUltrasoundInclusive = false, tenantId, isBrowserPrintout } = request.query;
          const actor = getAuthUser(request);
          if (!actor) return customError("Authentication required", 401, response);
          if (Number(tenantId) !== actor.tenantId) return customError("Organization scope does not match the session", 403, response);
          const employeeid = actor.employeeid;
		const browserMode = isBrowserPrintout == "1" || isBrowserPrintout == 1 || isBrowserPrintout == "true" ? true : false;
		const tenantIdP = parseInt(tenantId.toString())
		const pEmployeeId = parseInt(employeeid.toString());
		if (!employeeid || isNaN(pEmployeeId)) return customError("User Not recognized", 404, response);

		let creator = new Creator(0);

		const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid, ptid, target);

		if (patientid && billingid) {
			const isvalidBillingid = await Billing.checkValidityOfBillingid(tenantIdP, billingid);
			if (!isvalidBillingid) return response.send({ status: false, message: OperationsFailures.notFound });
			const billingScope = await (await KnexConnection(tenantIdP))('billing').where({ billingid, patientid }).first('billingid');
			if (!billingScope) return customError('The billing record does not belong to this patient', 403, response);
			const billingAscensions = await TestAscension.findAllBillingAssociatedTestAscensions(tenantIdP, billingid, false) as PrimeLimsTabletest_ascension[];
			const printableAscensionIds = new Set(await creator.getPrintableBillingAscensionIds(tenantIdP, billingid));
			const printableBillingAscensions = billingAscensions.filter((item) => printableAscensionIds.has(Number(item.id)));

			if (printableBillingAscensions.length === 0) return response.send({ status: false, message: 'No paid results available for printing' })

			let qualifiedForPrintOut = await Promise.all(
				printableBillingAscensions.map(async (ascensionItem: PrimeLimsTabletest_ascension, index: number) => {
					const { id, testid } = ascensionItem;
					const resultApproved = await ResultSettings.isApprovalLimitReached(tenantIdP, null, id as any, "minimum");
					return resultApproved ? { ascensionid: id, testid } : null
				})
			)

			qualifiedForPrintOut = qualifiedForPrintOut.filter((item: { ascensionid: number, testid: number } | null) => item?.ascensionid);


			// check each for acess window or acess permission allowed

			let accessPermissionTest = []
			const isPriviledgedUser = roleAllowed(actor.role, ['admin', 'manager']);

			for (let i = 0; i < qualifiedForPrintOut.length; i++) {
				const item = qualifiedForPrintOut[i];
				if (!item) continue;
                    if (normalizeRole(actor.role) === "scientist") await assertLabTestAccess(await KnexConnection(tenantIdP), actor, Number(item.ascensionid));
				let isWithinWindow = false;
				if (isPriviledgedUser) {
					isWithinWindow = true;
				} else {
					const ascensionid = item.ascensionid ? parseInt(item.ascensionid.toString()) : 0;
					isWithinWindow = await RequestAccess.verifyWindowPeriod(tenantIdP, ascensionid, pEmployeeId, "access");
				}
				isWithinWindow ? accessPermissionTest.push(item) : null;
			}

			if (accessPermissionTest.length == 0) {
				throw new Error(OperationsFailures.accessWindowExpired);
			}

			qualifiedForPrintOut = accessPermissionTest;

			if (qualifiedForPrintOut.length > 0) {
				const finalResult = {
					test: [] as any[],
					generalValidation: null,
					resultsettings: null,
					companyInfo: null,
					patientInformation: null,
					patientid: null,
					billingid: null,
					logourl: null,
					generalComments: ''
				}

				finalResult.test = await Promise.all(qualifiedForPrintOut.map(async ({ testid, ascensionid }) =>
					loadReleasedLaboratoryReport(tenantIdP, Number(patientid), Number(billingid), Number(testid), Number(ascensionid), browserMode),
				));

				const distinctTestIds = Array.from(new Set(qualifiedForPrintOut.map((item: any) => item?.testid).filter(Boolean)));
				// Only apply a per-test report override when the whole batch is a single test; mixed-test batches use the general settings.
				const resultsettings = distinctTestIds.length === 1
					? await TestReportSettings.resolve(tenantIdP, distinctTestIds[0])
					: await new ResultSettings(0).getResultSettings(tenantIdP);

				if (typeof resultsettings != "boolean") {
					finalResult.resultsettings = resultsettings as any
				}

				const companyInfo = await getAllCompanyProfiles(tenantIdP);

				if (companyInfo != null) {
					finalResult.companyInfo = companyInfo as any
				}

				const intPatientid = parseInt(patientid.toString());

				finalResult.patientInformation = await new Registration().getPatientBasicData(tenantIdP, intPatientid) as any
				finalResult.patientid = patientid as any;
				finalResult.billingid = billingid as any;

				const hostname = process.env.NODE_ENV === 'development'
					? process.env.APPHOST_DEVELOPMENT + ':' + process.env.DEVELOPMENT_PORT
					: process.env.APPHOST_PRODUCTION


				const httpProtocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';

				finalResult.logourl = `${httpProtocol}://${hostname}/api/v1/settings/companyprofile/images?tenantId=${tenantIdP}` as any;

				if (employeeid) {
					const employeedata = await new RolesRepository(tenantIdP).getRoleById(pEmployeeId);
					const { employeeid, username, role, mobile } = employeedata as IEmployee;
					finalResult.generalValidation = {
						employeeid,
						username,
						role,
						mobile
					} as any
				}
				return response.send(finalResult)
			}
		}

		return response.send({ status: false, message: OperationsFailures.invalidResquestQuery })

	} catch (err: any) {
          if (err?.statusCode) return response.status(err.statusCode).send({ status: 'error', message: err.message });
		const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
		responseError(response, errorMessage)
	}
}



export type resultPrintOutDataset = {
	resultsettings: null | ApplicationResultSettings,
	companyInfo: null | companyInfo,
	patientInformation: NewRegistration | null,
	hasDrugs: boolean,
	comments: null | string,
	records: previewReportView['result'],
	literatureReview: null | string | undefined,
	logourl: string,
	testname: string | null,
	validators: validatorsFinalFormatType[] | [],
	drugList?: { drug: string; sensitivity: string; id?: number; ascensionid?: number }[],
	lastupdatedon: Date | null,
	resultentry: any,
	testdetailcategory: null | TestDetailCategoryType[],
	testInfo: null | PrimeLimsTabletest_panels,
	enteredOn: Date | null,
	billingid: number,
	samplingInformation: null | testAscensionTableTypes,
	patientid: number,
	referrerFacility?: {
		clinicianId: number | null,
		organizationId: number | null,
		facility_name: string | null,
		facility_email: string | null,
		facility_phone: number | null
	} | null,
	generalValidation?: {
		employeeid: number,
		username: string,
		role: string,
		mobile: string
	}
}





export const getTestCreationRule = async (request: Request, response: Response) => {
	try {
		const { tenantId } = request.query;
		const testid = request.params.testid;

		if (!testid || !tenantId) {
			return customError("testid and tenantId are required", 400, response);
		}

		const parsedTestId = parseInt(testid.toString());
		const parsedTenantId = parseInt(tenantId.toString());

		const repository = new TestCreationRulesRepository(parsedTenantId);
		const rules = await repository.findByTestId(parsedTestId);

		if (!rules || rules.length === 0) {
			return response.json({
				status: false,
				message: "No test creation rules found"
			});
		}

		return response.json({
			status: true,
			data: rules
		});
	} catch (error) {
		return responseError(response);
	}
};


export const completeFlowByPassHandler = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as string);
		const employeeId = req.body.employeeid;
		const billingid = req.body.billingid;
		if (!billingid || !employeeId) {
			return res.status(400).json({ status: 'error', message: 'Missing required parameters: billingid, employeeid, tenantId' });
		}
		const result = await TestAscension.completeFlowByPass(tenantId, parseInt(billingid as string), parseInt(employeeId as string));
		res.send({ status: result == true ? 'success' : 'error', message: result == true ? 'Workflow prerequisites satisfied' : 'Required laboratory stages remain pending. Open Daily Requests to complete them.' });
	} catch (error) {
		res.status(500).json({ status: 'error', message: 'Internal server error' });
	}
}


export const completeFlowByPassMultipleHandler = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as string);
		const employeeId = req.body.employeeid;
		const billingids: number[] = req.body.billingIds;
		if (!billingids || !employeeId || !Array.isArray(billingids) || billingids.length === 0) {
			return res.status(400).json({ status: 'error', message: 'Missing required parameters: billingids (array), employeeid, tenantId' });
		}

		const result = await TestAscension.completeFlowByPassMultiple(tenantId, billingids, parseInt(employeeId as string));
		res.send({ status: result == true ? 'success' : 'error', message: result == true ? 'Workflow prerequisites satisfied' : 'Required laboratory stages remain pending. Open Daily Requests to complete them.' });
	} catch (error) {
		res.status(500).json({ status: 'error', message: 'Internal server error' });
	}
}

export const setResultDeliveryPreference = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as unknown as string, 10);
		const { billingid, preferences } = req.body || {};
          const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
          const employeeid = actor.employeeid;
		const pBillingId = parseInt(String(billingid), 10);

		if (!pBillingId || isNaN(pBillingId)) {
			return customError("billingid must be a number", 400, res);
		}

		const conn = await KnexConnection(tenantId);
		const billing = await conn('billing').select('patientid', 'branchid').where({ billingid: pBillingId }).first();
          if (!billing || (actor.branch != null && Number(billing.branchid) !== Number(actor.branch))) return res.status(403).json({ status: false, message: 'Billing access denied' });
		if (!billing || !billing.patientid) {
			return customError("billing record not found", 404, res);
		}

		if (preferences && Array.isArray(preferences) && preferences.length > 0) {
			const testPreferences = preferences.map((pref: any) => ({
				billingid: pBillingId,
				ascensionid: pref.ascensionid,
				patientid: billing.patientid,
				requested_mode: (pref.requested_mode || '').trim().toLowerCase(),
				requested_mode_detail: pref.requested_mode_detail ?? null,
				updated_by_employeeid: pref.employeeid ?? employeeid ?? null
			}));

			// Validate each preference has testid and requested_mode
			for (const pref of testPreferences) {
				if (!pref.ascensionid || isNaN(parseInt(String(pref.ascensionid)))) {
					return customError("Each preference must have a valid ascensionid", 400, res);
				}
				if (!pref.requested_mode) {
					return customError("Each preference must have a requested_mode", 400, res);
				}
			}

			const status = await new ResultDeliveryClass(pBillingId, tenantId).setMultipleTestResultDeliveryPreferences(testPreferences as any);
			return res.send({ status, message: `Updated ${testPreferences.length} test preference(s)` });
		}

		// Legacy format: single billing-level preference
		const { requested_mode, requested_mode_detail } = req.body || {};
		if (!requested_mode || typeof requested_mode !== 'string') {
			return customError("requested_mode is required", 400, res);
		}

		const payload = {
			billingid: pBillingId,
			patientid: billing.patientid,
			requested_mode: requested_mode.trim().toLowerCase(),
			requested_mode_detail: requested_mode_detail ?? null,
			updated_by_employeeid: employeeid ?? null,
			updated_at: conn.fn.now()
		};

		const status = await new ResultDeliveryClass(pBillingId, tenantId).setResultDeliveryPreference(payload);

		res.send({ status });
	} catch (err) {
		responseError(res, err);
	}
};

export const getResultDeliveryPreference = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as unknown as string, 10);
		const billingid = parseInt(String(req.params.billingid || req.query.billingid), 10);
		if (!billingid || isNaN(billingid)) {
			return customError("billingid must be a number", 400, res);
		}

		const deliveryPrefs = await new ResultDeliveryClass(billingid, tenantId).getAllResultDeliveryPreferencesForTransaction();

		res.send({
			status: true,
			preferences: deliveryPrefs || []
		});
	} catch (err) {
		responseError(res, err);
	}
};



export const getResultRecordUndelivered = async (req: Request<{}, {}, {}, { tenantId: string; startDate: string; count: string; page: string; endDate: string; search?: string; mode?: string; issuesOnly?: string }>, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as unknown as string, 10);
		const startDate = req.query.startDate;
		const endDate = req.query.endDate;
		const count = req.query.count ? parseInt(req.query.count as unknown as string, 10) : 0;
		const page = req.query.page ? parseInt(req.query.page as unknown as string, 10) : 1;
		const undeliveredRecords = await new ResultDeliveryClass(0, tenantId, getAuthUser(req)?.branch).getResultsUndelivered(startDate, endDate, page, count, {
			search: req.query.search, mode: req.query.mode, issuesOnly: req.query.issuesOnly === 'true',
		});
		res.setHeader('Cache-Control', 'private, no-store');

		res.send({
			status: true,
			records: undeliveredRecords || []
		});
	} catch (err) {
		responseError(res, err);
	}
};
type ResultDeliveryActor = NonNullable<ReturnType<typeof getAuthUser>>;

function deliveryInputError(message: string) {
	return Object.assign(new Error(message), { statusCode: 400 });
}

async function saveResultDelivery(actor: ResultDeliveryActor, body: Record<string, unknown> | undefined, requireTest = false) {
	const { billingid, ascensionid, delivered_mode, notes, failurenotes } = body || {};
	const billId = Number(billingid);
	const testId = ascensionid == null ? null : Number(ascensionid);
	if (!Number.isSafeInteger(billId) || billId < 1) throw deliveryInputError('A valid billing ID is required');
	if ((requireTest || testId != null) && (testId == null || !Number.isSafeInteger(testId) || testId < 1)) {
		throw deliveryInputError('A valid ordered test ID is required');
	}
	const mode = typeof delivered_mode === 'string' ? delivered_mode.trim().toLowerCase() : null;
	const failure = typeof failurenotes === 'string' ? failurenotes.trim() : '';
	if ((!mode || mode === 'not_delivered') && !failure) throw deliveryInputError('Select a delivery mode or enter a failure reason');
	if (mode && mode.length > 30) throw deliveryInputError('Delivery mode is too long');
	if ((notes != null && typeof notes !== 'string') || (typeof notes === 'string' && notes.length > 2000) || failure.length > 2000) {
		throw deliveryInputError('Delivery notes must be text of at most 2000 characters');
	}

	const result = await new ResultDeliveryClass(billId, actor.tenantId, actor.branch).updateResultDeliveryLog({
		ascensionid: testId,
		billingid: billId,
		delivered_mode: failure ? null : mode,
		delivered_by_employeeid: actor.employeeid,
		notes: typeof notes === 'string' ? notes : null,
		failurenotes: failure || null,
	});
	if (result && mode && !failure) {
		InAppNotificationService.publish(actor.tenantId, {
			eventCode: 'RESULT_DELIVERED',
			module: 'result',
			title: 'Result delivered',
			message: 'A result delivery was recorded.',
			referenceType: testId ? 'ascension' : 'billing',
			referenceId: testId ?? billId,
			actorEmployeeId: actor.employeeid,
		}).catch(() => {});
	}
	return result;
}

export const recordResultDelivery = async (req: Request, res: Response) => {
	const actor = getAuthUser(req);
	if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
	try {
		const result = await saveResultDelivery(actor, req.body);
		return res.status(201).send({ status: true, result });
	} catch (error: any) {
		if (error.statusCode) return res.status(error.statusCode).json({ status: false, message: error.message });
		return responseError(res, error);
	}
};

export const recordBulkResultDelivery = async (req: Request, res: Response) => {
	const actor = getAuthUser(req);
	if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
	const deliveries = req.body?.deliveries;
	if (!Array.isArray(deliveries) || deliveries.length === 0 || deliveries.length > 400) {
		return res.status(400).json({ status: false, message: 'Select between 1 and 400 delivery records' });
	}

	const results: Array<{ status: boolean; message?: string }> = [];
	for (const delivery of deliveries) {
		try {
			await saveResultDelivery(actor, delivery, true);
			results.push({ status: true });
		} catch (error: any) {
			if (!error.statusCode) console.error('Bulk result delivery write failed', { code: error.code });
			results.push({ status: false, message: error.statusCode ? error.message : 'The server could not record this delivery' });
		}
	}
	return res.json({ status: true, results });
};

export const recordResultHandover = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as unknown as string, 10);
		const { billingid, from_employeeid, to_employeeid, status, notes } = req.body || {};
		const pBillingId = parseInt(String(billingid), 10);
		const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
          const pFrom = actor.employeeid;
		const pTo = parseInt(String(to_employeeid), 10);
		if (!pBillingId || isNaN(pBillingId) || !pFrom || isNaN(pFrom) || !pTo || isNaN(pTo)) {
			return customError("billingid, from_employeeid and to_employeeid must be numbers", 400, res);
		}

		const conn = await KnexConnection(tenantId);
		const billing = await conn('billing').select('patientid').where({ billingid: pBillingId }).first();
		const patientid = billing && billing.patientid ? billing.patientid : null;

		const [id] = await conn('result_handover_log').insert({
			billingid: pBillingId,
			patientid,
			from_employeeid: pFrom,
			to_employeeid: pTo,
			status: status ? String(status).trim().toLowerCase() : 'handover',
			notes: notes ?? null,
			created_at: conn.fn.now()
		});

		res.status(201).send({ status: true, id });
	} catch (err) {
		if ((err as any)?.statusCode) return res.status((err as any).statusCode).json({ status: false, message: (err as any).message });
          responseError(res, err);
	}
};

export const getResultDeliveryChain = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as unknown as string, 10);
		const billingid = parseInt(String(req.params.billingid), 10);
		if (!billingid || isNaN(billingid)) return customError("billingid must be a number", 400, res);
		const deliveryChain = await new ResultDeliveryClass(billingid, tenantId, getAuthUser(req)?.branch).getResultDeliveryChain();
		if (deliveryChain && deliveryChain.status === true) return res.send(deliveryChain);
		return res.send({ status: false, message: "No delivery chain found" });
	} catch (err: any) {
          if (err.statusCode) return res.status(err.statusCode).json({ status: false, message: err.message });
		responseError(res, err);
	}
};
