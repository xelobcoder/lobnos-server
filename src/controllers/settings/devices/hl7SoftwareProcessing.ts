import { TiifuWorkingClass } from "../../../database/TiifuWorkingClass";
import Creator from "../../../models/creator/creator";
import { TestAscension } from "../../../models/operations/ascension";
import TestCreationRulesRepository from "../../../models/TestCreation/TestCreationRulesRepository";
import { testpanel } from "../../../testpanel/testpanelList";

import { Request, Response } from 'express';
import DeviceModelsVersionProcessing from "./DeviceDataProcessing";
export interface IMshSegment {
     DATE_TIME_OF_MESSAGE: string;
     FIELD_SEPARATOR: string;
     MESSAGE_CONTROL_ID: string;
     MESSAGE_TYPE: string;
     PROCESSING_ID: string;
     RECEIVING_APPLICATION: string;
     RECEIVING_FACILITY: string;
     SECURITY: string;
     SEGMENT: 'MSH';
     SENDING_APPLICATION: string;
     SENDING_FACILITY: string;
     VERSION_ID: string;
}

export interface IPidSegment {
     DATE_OF_BIRTH: string;
     DATE_OF_DEATH: string;
     DRIVERS_LICENSE_NUMBER: string;
     ETHNICITY: string;
     LANGUAGE: string;
     MARITAL_STATUS: string;
     PATIENT_ACCOUNT_NUMBER: string;
     PATIENT_ADDRESS: string;
     PATIENT_CLASS: string;
     PATIENT_ID: string;
     PATIENT_NAME: string;
     PATIENT_TYPE: string;
     PHONE_NUMBER: string;
     PLACE_OF_BIRTH: string;
     RACE: string;
     RELIGION: string;
     SEGMENT: 'PID';
     SET_ID: string;
     SEX: string;
     SSN_NUMBER: string;
}

export interface IObrSegment {
     COLLECTION_VOLUME: string;
     COLLECTOR_IDENTIFIER: string;
     FILLER_ORDER_NUMBER: string;
     OBSERVATION_DATE_TIME: string;
     OBSERVATION_END_DATE_TIME: string;
     ORDERING_PROVIDER: string;
     PLACER_ORDER_NUMBER: string;
     PRIORITY: string;
     RELEVANT_CLINICAL_INFO: string;
     REQUESTED_DATE_TIME: string;
     SEGMENT: 'OBR';
     SET_ID: string;
     SPECIMEN_ACTION_CODE: string;
     SPECIMEN_RECEIVED_DATE_TIME: string;
     SPECIMEN_SOURCE: string;
     UNIVERSAL_SERVICE_ID: string;
}

export interface IObxSegment {
     ABNORMAL_FLAGS: string;
     OBSERVATION_DATE_TIME: string;
     OBSERVATION_ID: string;
     OBSERVATION_SUB_ID: string;
     OBSERVATION_VALUE: string;
     REFERENCE_RANGE: string;
     RESULT_STATUS: string;
     SEGMENT: 'OBX';
     SET_ID: string;
     UNITS: string;
     VALUE_TYPE: string;
}

export type IInterfacingSegment = IMshSegment | IPidSegment | IObrSegment | IObxSegment | { SEGMENT: string;[key: string]: any };

export interface IInterfacingDevicePayload {
     data: IInterfacingSegment[];
     device: {
          sending_application: string;
          sending_facility: string;
          testid: string;
          [key: string]: any;
     };
     timestamp: string;
}




//  this is now obsolote function and will be removed in future releases
export async function handleReceivedIntefacingData(req: Request<{}, {}, IInterfacingDevicePayload>, res: Response) {
     try {
          const tenantId = Number(req.query.tenantId) || 3;
          const { data, device, timestamp } = req.body;
          // Check if data contains only '\x02' segment and ignore it
          if (data.length === 1 && data[0].SEGMENT === '\x02') {
               return res.status(200).json({
                    status: "ignored",
                    message: "Data contains only control character segment, ignoring"
               });
          }



          // filter obx segments with fallback for OBSERVATION_SUB_ID
          const obxSegments = data.filter(seg => {
               if (seg.SEGMENT !== 'OBX') return false;
               // Fallback: treat OBSERVATION_ID as OBSERVATION_SUB_ID if OBSERVATION_SUB_ID is empty
               if (!seg.OBSERVATION_SUB_ID || seg.OBSERVATION_SUB_ID.trim() === "") {
                    seg.OBSERVATION_SUB_ID = seg.OBSERVATION_ID;
               }
               // If OBSERVATION_SUB_ID contains ^, pick the middle value
               if (typeof seg.OBSERVATION_SUB_ID === 'string' && seg.OBSERVATION_SUB_ID.includes('^')) {
                    const parts = seg.OBSERVATION_SUB_ID.split('^');
                    if (parts.length >= 3) {
                         seg.OBSERVATION_SUB_ID = parts[1]; // pick the middle value
                    } else if (parts.length === 2) {
                         seg.OBSERVATION_SUB_ID = parts[1]; // fallback to second value
                    } // else leave as is
               }
               return true;
          }) as IObxSegment[];


          const pidSegment = data.find(seg => seg.SEGMENT === 'PID') as IPidSegment;

          let rawPatientId = pidSegment?.PATIENT_ID || "";

          // If PATIENT_ID contains ^, extract the first part that has the format we need
          let cleanedPatientId = "";
          if (typeof rawPatientId === 'string' && rawPatientId.includes('^')) {
               const parts = rawPatientId.split('^');
               for (const p of parts) {
                    // Remove all characters except numbers and hyphen
                    const cleaned = p.replace(/[^0-9-]/g, "");
                    if (cleaned.includes('-') && cleaned.match(/^\d+-\d+$/)) {
                         cleanedPatientId = cleaned;
                         break;
                    }
               }
          } else {
               // Remove all characters except numbers and hyphen
               cleanedPatientId = rawPatientId.replace(/[^0-9-]/g, "");
          }

          // Validate format is number-number
          if (!cleanedPatientId.match(/^\d+-\d+$/)) {
               return res.status(400).json({ error: "Invalid patient ID format. Expected format: number-number" });
          }

          // Extract ascension ID (first number before hyphen) for lookup
          const ascensionId = cleanedPatientId.split('-')[0];
          const employeeid = Number(cleanedPatientId.split('-')[1]);
          const providedTestIdx = device.testid;


          if (!providedTestIdx || !Array.isArray(providedTestIdx) || providedTestIdx.length === 0) return res.status(400).json({ error: "Provided test index is required" });
          if (!ascensionId) return res.status(400).json({ error: "Ascension ID is required" });

          const ascensionInformation = await TestAscension.findAscension(tenantId, Number(ascensionId));
          if (!ascensionInformation) return res.status(404).json({ error: "Ascension information not found" });
          const knownTestId = ascensionInformation.testid;
          // if (!providedTestIdx.includes(knownTestId)) {
          //      return res.status(400).json({ error: "Provided test ID does not match ascension information assciated testid" });
          // }

          const getMappingInformatoion = await testpanel.getTestInfo(tenantId, knownTestId);

          if (!getMappingInformatoion) return res.status(404).json({ error: "Test information not found for the provided test ID" });

          const deviceInterfaceMapping = getMappingInformatoion['deviceInterfaceMapping'] != null ?
               typeof getMappingInformatoion['deviceInterfaceMapping'] === 'string' ?
                    JSON.parse(getMappingInformatoion['deviceInterfaceMapping']) :
                    getMappingInformatoion['deviceInterfaceMapping']
               : null;

          const testCreationRules = await new TestCreationRulesRepository(tenantId).findByTestId(knownTestId);

          // Extract OBX values for mapped analytes and merge with testCreationRules
          let obxResults: Array<{ fieldid: number; value: string; originalvalue: string; field: string; entrymode: string }> = [];
          if (deviceInterfaceMapping && typeof deviceInterfaceMapping === 'object') {
               for (const [deviceCode, analyte] of Object.entries(deviceInterfaceMapping)) {
                    const matchingObx = obxSegments.filter(seg => seg.OBSERVATION_SUB_ID === analyte);
                    for (const obx of matchingObx) {
                         const fieldidNum = Number(deviceCode);
                         const rule = Array.isArray(testCreationRules) ? testCreationRules.find(r => r.id === fieldidNum) : undefined;
                         obxResults.push({
                              fieldid: fieldidNum,
                              value: obx.OBSERVATION_VALUE,
                              originalvalue: obx.OBSERVATION_VALUE,
                              field: rule?.name || '',
                              entrymode: 'automatic'
                         });
                    }
               }
          }

          if (obxResults.length === 0) return res.status(400).json({ error: "No OBX results found for the provided device mapping" });
          const { billingid } = ascensionInformation;
          const comments = '';
          const csvid = `Qzb6uPyN0T0qRx8UE2NIjsusvUSxD4Hnc5iWR9DGFuBRg7YxeCO3fnSrw59LTptnNNPq3t${billingid}`
          const drugs = [] as any[];

          const patientInfo = await new TiifuWorkingClass('billing').findOne(tenantId, 'billingid', billingid);
          if (!patientInfo) return res.status(404).json({ error: "Patient ID not found for the provided billing ID" });


          const patientid = patientInfo.patientid;
          const ptid = `USxD4Hnc5iWR9DGFuBRg7YxeCQzb6uPyN0T0qRx8UE2NIjsusv${patientid.toString()}`

          const finalData = { testid: knownTestId, ascensionid: ascensionId, isScan: false, csvid, ptid, comments, drugs, employeeid, fields: obxResults, hasDrugs: false };
          const resultEntry = await new Creator(knownTestId).resultEntry(tenantId, finalData as any);

          return res.status(200).json({
               status: resultEntry ? "success" : "error",
               message: "Data processed successfully",
               ascensionInformation,
               getMappingInformatoion,
               obxResults
          });

     } catch (err: any) {
          console.log("Error processing interfacing data:", err);
          res.status(500).json({ error: err.message });
     }
}



export async function handleReceivedIntefacingDataProcessor(req: Request<{}, {}, { payload: any; name: string }>, res: Response) {
     try {
          const { payload, name } = req.body;
          if (!payload || !name) {
               return res.status(400).json({ error: "Payload and name are required" });
          }

          const tenantId = req.query.tenantId;
          switch (name) {
               case "MindRay":
                    return await DeviceModelsVersionProcessing.MindRayDeviceBClassProcessor(Number(tenantId), { data: payload } as any);
               case "AgileS20":
                    return await DeviceModelsVersionProcessing.AgileS20DeviceProcessor(Number(tenantId), { data: payload } as any);
               case "BioeLab":
                    return await DeviceModelsVersionProcessing.bioLabDeviceProcessor(Number(tenantId), payload);
               default:
                    return res.status(400).json({ error: "Unsupported device name" });
          }
     } catch (err) {
          res.status(500).json({ error: "Internal server error" });
     }
}