import { Request, Response } from "express";
import { OperationsFailures, validatorsFinalFormatType } from "../../models/operations/types";
import ResultSettings, { ApplicationResultSettings } from "../../models/application/appsettings/resultSettings";
import { companyInfo, getAllCompanyProfiles } from "../../models/settings/companyProfile";
import Registration from "../../models/registration/registration";
import { NewRegistration } from "../../models/registration/types";
// import TestSetup from '../../../api/models/testSetup.model'
import ResultPrint from "../../models/result/resultPrint";
import { TestAscension } from "../../models/operations/ascension";
import { customError, responseError } from "../../hooks/helper";
import { CreationRule, previewReportView, resultEntryType } from "../../models/creator/creator-types";
import TestLiteratureSetup from "../../testpanel/literature";
import resultEncrptionReferer from "../../models/creator/resultEncryptionReferer";
import Creator from "../../models/creator/creator";
import { Billing } from "../../models/billing/billing";
import { PrimeLimsTabletest_ascension, PrimeLimsTabletest_panels } from "../../database/DatabaseTableSchema";
import TestCreationRulesRepository from "../../models/TestCreation/TestCreationRulesRepository";
import { testAscensionTableTypes } from "../../models/billing/billingclientTypes";
import RolesRepository, { IEmployee } from "../../models/settings/users/RolesRepository";
import { TestDetailCategoryType } from "../../models/operations/testFieldsCategoryClass";
import RequestAccess from "../../models/security/RequestAcessResult/requestAcess";
import { Services } from "../../models/services/services";

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

export const resultEntry = async (req: Request<{}, {}, { testid: number }, { tenantId: number }>, response: Response): Promise<void> => {
	try {
		const { tenantId } = req.query
		const { testid } = req.body;
		if (isNaN(testid)) return customError("testid must be a number", 400, response);
		const tenantIdP = parseInt(tenantId.toString())

		const isDataInserted = await new Creator(testid).resultEntry(tenantIdP, req.body as unknown as resultEntryType);
		if (isDataInserted == true) {
			response.send({ status: "success", statusCode: 200, message: "records updated successfully" });
		} else {
			response.send({ status: "failed", statusCode: 404, message: "error occured saving results" });
		}
	} catch (err) {
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
					const { resources } = decryptedResult;
					if (resources && Array.isArray(resources) && resources.length > 0) {
						result = result.map((item: any, index: number) => {
							return { ...item, value: resources[index]['value'] }
						})
						return response.send({ ...records, result });
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



export const criticalValuesUnseenHandler = async (request: Request<{}, {}, {}, { count: string, page: string, tenantId: string }>, response: Response) => {
	try {
		const { count, page, tenantId } = request.query;

		const tenantIdP = parseInt(tenantId.toString())

		const parsedCount = parseInt(count.toString());
		const parsedPage = parseInt(page.toString());
		// const unSeenArray = await TrackValuesAlertClass.getUnviewedTracksAlert(tenantIdP, parsedCount, parsedPage);
		// response.send(unSeenArray);
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
		const isPaymentStatusValid = await new Creator(0).CheckPaymentStatus(tenantIdP, numAscensionId);
		if (!isPaymentStatusValid) {
			return customError("Cannot Print Result For Unpaid Service or test", 403, response);
		} else {
			next()
		}
	} catch (err) {
		responseError(response, err);

	}

}

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
		const { ascensionId, testid, csvid, ptid, target, isScan = false, tenantId, employeeid, isBrowserPrintout } = request.query;
		const browserMode = isBrowserPrintout == "1" || isBrowserPrintout == 1 || isBrowserPrintout == "true" ? true : false;
		const tenantIdP = parseInt(tenantId.toString())
		let isWithinWindow = false;

		if (!ascensionId) return customError(OperationsFailures.invalidResquestQuery + ". ascensionid not provided", 404, response);
		const numAscensionId = parseInt(ascensionId.toString());
		const userRole = await new RolesRepository(tenantIdP).getRoleById(parseInt(employeeid.toString()));

		if (userRole && ['admin', 'manager', 'super-admin'].includes(userRole.role.toLowerCase()) == false) {
			isWithinWindow = await RequestAccess.verifyWindowPeriod(tenantIdP, ascensionId, parseInt(employeeid), "access");
		} else {
			isWithinWindow = true
		}
		if (!isWithinWindow) {
			return customError(OperationsFailures.accessWindowExpired, 403, response);
		}
		const resultApproved = await ResultSettings.isApprovalLimitReached(tenantIdP, null, numAscensionId as any, "minimum");
		if (!resultApproved && !isScan) {
			return response.send({ message: OperationsFailures.minimumResultValidation })
		}


		const parsedTestId = parseInt(testid.toString());
		let creator = new Creator(parsedTestId);
		const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid, ptid, target);

		const dataset: resultPrintOutDataset = {
			resultsettings: null,
			records: [],
			companyInfo: null,
			patientInformation: null,
			comments: null,
			testname: '',
			validators: [],
			hasDrugs: false,
			patientid,
			billingid,
			lastupdatedon: null,
			logourl: '',
			enteredOn: null,
			samplingInformation: null,
			resultentry: null,
			literatureReview: null,
			testInfo: null,
			testdetailcategory: null,
		};

		const resultsettings = await new ResultSettings(tenantIdP).getResultSettings(tenantIdP);

		if (typeof resultsettings != "boolean") dataset.resultsettings = resultsettings;
		const companyInfo = await getAllCompanyProfiles(tenantIdP);
		if (companyInfo != null) dataset.companyInfo = companyInfo;
		const intPatientid = parseInt(patientid.toString());
		const patientInformation = await new Registration().getPatientBasicData(tenantIdP, intPatientid);

		if (patientInformation != null) {
			dataset.patientInformation = patientInformation
		}

		const comments = await creator.getCustomCommentsRecords(
			tenantIdP,
			billingid, parsedTestId);
		dataset.comments = comments

		const literatureReview: { can: boolean, literature?: string } = await new TestLiteratureSetup("").getResultLiterature(tenantIdP, testid)

		if (literatureReview.can != false) {
			dataset.literatureReview = literatureReview.literature
		}

		let records = await new Creator(testid).resultPresentationView(tenantIdP, parsedTestId, billingid, patientid) as previewReportView;

		if (browserMode && typeof records != "string" && records.result && Array.isArray(records.result)) {
			records.result = await ResultPrint.decryptResultArray(records.result);
		}

		if (records != null && typeof records != "string" && !Array.isArray(records)) {
			const { result, testname, hasDrugs, testInfo, testdetailcategory } = records;
			// Sort result in ascending order by 'ordering' property if present
			if (Array.isArray(result) && result.length > 0 && result[0].hasOwnProperty('ordering')) {
				dataset.records = [...result].sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));
			} else {
				dataset.records = result;
			}
			dataset.testname = testname
			dataset.hasDrugs = hasDrugs
			dataset.testInfo = testInfo || null
			dataset.testdetailcategory = testdetailcategory || null
		}

		if (dataset.hasDrugs == true) {
			const drugList = await TestAscension.getAscensionSavedDrugs(tenantIdP, numAscensionId, parsedTestId);
			if (Array.isArray(drugList) && drugList.length > 0) {
				dataset.drugList = drugList.filter((drug) => {
					return ['Resistant', 'Sensitive'].includes(drug.sensitivity);
				}) as [];
			} else {
				dataset.drugList = drugList as [];
			}
		}

		let samplingInformation = await TestAscension.findAscension(tenantIdP, numAscensionId);
		if (samplingInformation != null) {
			dataset.samplingInformation = samplingInformation;
		}

		// Get referrer facility information from services table
		const referrerFacility = await Services.getRefererFacilityByBillingId(tenantIdP, billingid);
		if (referrerFacility) {
			dataset.referrerFacility = referrerFacility;
		}

		let resultEntry = await new ResultPrint(billingid).getResultEntryScientist(tenantIdP, billingid, parsedTestId, numAscensionId);

		const { validators, resultentry, lastupdatedon, enteredOn } = resultEntry;

		dataset.validators = validators;
		dataset.lastupdatedon = lastupdatedon as Date || null;
		dataset.resultentry = resultentry
		const hostname = process.env.NODE_ENV === 'development'
			? process.env.APPHOST_DEVELOPMENT + ':' + process.env.DEVELOPMENT_PORT
			: process.env.APPHOST_PRODUCTION + ':' + process.env.PRODUCTION_PORT;

		dataset.logourl = `http://${hostname}/api/v1/settings/companyprofile/images`
		dataset.enteredOn = enteredOn as Date || null;

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
	} catch (err) {
		responseError(response);
	}
}



export const getResultPrintMultipleHandler = async (request: Request<{}, {}, {}, { csvid: string, ptid: string, target: string, employeeid: number | string, isBrowserPrintout: number | string, isUltrasoundInclusive: boolean, tenantId: string }>, response: Response) => {
	try {
		const { csvid, ptid, target, isUltrasoundInclusive = false, tenantId, isBrowserPrintout, employeeid } = request.query;
		const browserMode = isBrowserPrintout == "1" || isBrowserPrintout == 1 || isBrowserPrintout == "true" ? true : false;
		const tenantIdP = parseInt(tenantId.toString())
		const pEmployeeId = parseInt(employeeid.toString());
		if (!employeeid || isNaN(pEmployeeId)) return customError("User Not recognized", 404, response);

		let creator = new Creator(0);

		const { billingid, patientid } = creator.sanitize_patientid_billingid_query(csvid, ptid, target);

		if (patientid && billingid) {
			const isvalidBillingid = await Billing.checkValidityOfBillingid(tenantIdP, billingid);
			if (!isvalidBillingid) return response.send({ status: false, message: OperationsFailures.notFound });
			const billingAscensions = await TestAscension.findAllBillingAssociatedTestAscensions(tenantIdP, billingid, false) as PrimeLimsTabletest_ascension[] | []

			if (billingAscensions.length === 0) return response.send({ status: false, message: 'No result Associated with billingid' })

			let qualifiedForPrintOut = await Promise.all(
				billingAscensions.map(async (ascensionItem: PrimeLimsTabletest_ascension, index: number) => {
					const { id, testid } = ascensionItem;
					const resultApproved = await ResultSettings.isApprovalLimitReached(tenantIdP, null, id as any, "minimum");
					return resultApproved ? { ascensionid: id, testid } : null
				})
			)

			qualifiedForPrintOut = qualifiedForPrintOut.filter((item: { ascensionid: number, testid: number } | null) => item?.ascensionid);


			// check each for acess window or acess permission allowed

			let accessPermissionTest = []
			const currentRole = await new RolesRepository(tenantIdP).getRoleById(pEmployeeId) as IEmployee;
			const isPriviledgedUser = currentRole && ['admin', 'manager', 'super-admin'].includes(currentRole.role.toLowerCase());

			for (let i = 0; i < qualifiedForPrintOut.length; i++) {
				const item = qualifiedForPrintOut[i];
				if (!item) continue;
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

				finalResult.test = await Promise.all(qualifiedForPrintOut.map(async (item: any, index) => {
					const { testid, ascensionid } = item;
					let dataset = {
						literatureReview: null,
						records: null,
						testname: '',
						hasDrugs: false,
						drugList: [],
						validators: [],
						lastupdatedon: '',
						resultentry: '',
						comments: '',
						testInfo: null,
						testdetailcategory: null,
						referrerFacility: null,
					};
					const literatureReview: { can: boolean, literature?: string } = await new TestLiteratureSetup('').getResultLiterature(tenantIdP, testid)

					if (literatureReview.can != false) {
						dataset.literatureReview = literatureReview.literature as any
					}

					let resultEntry = await new ResultPrint(billingid).getResultEntryScientist(tenantIdP, billingid, item.testid, item.ascensionid);

					const { validators, resultentry, lastupdatedon, enteredOn } = resultEntry;
					dataset.validators = validators as any
					dataset.resultentry = resultentry as any
					dataset.lastupdatedon = enteredOn as string || lastupdatedon as string


					const records = await new Creator(testid).resultPresentationView(tenantIdP, testid, billingid, patientid) as previewReportView


					if (records != null && typeof records != "string") {
						const { result, testname, hasDrugs, testInfo, testdetailcategory } = records;
						dataset.records = result as any
						if (browserMode && typeof records != "string" && records.result && Array.isArray(records.result)) {
							dataset.records = await ResultPrint.decryptResultArray(records.result);
						}
						dataset.testname = testname as any
						dataset.hasDrugs = hasDrugs
						dataset.testInfo = testInfo || null as any
						dataset.testdetailcategory = testdetailcategory || null as any
					}

					if (dataset.hasDrugs == true) {
						const drugList = await TestAscension.getAscensionSavedDrugs(tenantIdP, ascensionid, testid);
						if (Array.isArray(drugList) && drugList.length > 0) {
							dataset.drugList = drugList.filter((drug) => {
								return ['Resistant', 'Sensitive'].includes(drug.sensitivity);
							}) as [];
						} else {
							dataset.drugList = drugList as [];
						}
					}

					// Get referrer facility information from services table
					const referrerFacility = await Services.getRefererFacilityByBillingId(tenantIdP, billingid);
					if (referrerFacility) {
						dataset.referrerFacility = referrerFacility;
					}

					const comments = await creator.getCustomCommentsRecords(
						tenantIdP,
						billingid, testid);
					if (typeof dataset.comments === "string" && typeof comments === "string") {
						finalResult.generalComments = finalResult.generalComments + " " + comments;
					}
					return dataset
				}))

				const resultsettings = await new ResultSettings(0).getResultSettings(tenantIdP);

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
					: process.env.APPHOST_PRODUCTION + ':' + process.env.PRODUCTION_PORT;

				finalResult.logourl = `http://${hostname}/api/v1/settings/companyprofile/images` as any;

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

	} catch (err) {
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
	drugList?: [],
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
		res.send({ status: result == true ? 'success' : 'error', message: result == true ? 'Operation completed successfully' : 'Operation failed' });
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
		res.send({ status: result == true ? 'success' : 'error', message: result == true ? 'Operation completed successfully' : 'Operation failed' });
	} catch (error) {
		res.status(500).json({ status: 'error', message: 'Internal server error' });
	}
}
