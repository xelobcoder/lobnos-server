// import { TiifuWorkingClass } from "../../../database/TiifuWorkingClass";
// import Creator from "../../../models/creator/creator";
// import { TestAscension } from "../../../models/operations/ascension";
// import TestCreationRulesRepository from "../../../models/TestCreation/TestCreationRulesRepository";
// import { testpanel } from "../../../testpanel/testpanelList";
// import { PRIME_LAB_SYS_DEVICE_CONFIG } from "./constants/config";
// import { IInterfacingDevicePayload, IObxSegment } from "./hl7SoftwareProcessing";
// import { BioLabInterfacingMessage } from "./interface/IBioLab";

// class DeviceModelsVersionProcessing {
//      static validatePatientId(patientId: string): { ascensionId: number; employeeid: number } {
//           if (!patientId || isNaN(Number(patientId))) {
//                throw new Error("Patient ID is missing or invalid in the payload");
//           }

//           const splitedPatientId = patientId.split('-');
//           if (splitedPatientId.length !== 2) {
//                throw new Error("Patient ID format is invalid. Expected format: ascensionId-employeeId");
//           }

//           const ascensionId = Number(splitedPatientId[0]);
//           const employeeId = Number(splitedPatientId[1]);

//           if (isNaN(ascensionId) || isNaN(employeeId)) {
//                throw new Error("Ascension ID or Employee ID is not a valid number");
//           }

//           return { ascensionId, employeeid: employeeId };
//      }

//      static getDeviceInterfaceData(
//           knownTestId: number,
//           tenantId: number
//      ): Promise<{ deviceInterfaceMapping: Record<string, any> | null; testCreationRules: any[] }> {
//           return (async () => {
//                const getMappingInformatoion = await testpanel.getTestInfo(tenantId, knownTestId);

//                if (!getMappingInformatoion) {
//                     throw new Error("Test information not found for the provided test ID");
//                }

//                const deviceInterfaceMapping = getMappingInformatoion['deviceInterfaceMapping'] != null ?
//                     typeof getMappingInformatoion['deviceInterfaceMapping'] === 'string' ?
//                          JSON.parse(getMappingInformatoion['deviceInterfaceMapping']) :
//                          getMappingInformatoion['deviceInterfaceMapping']
//                     : null;

//                const testCreationRules = await new TestCreationRulesRepository(tenantId).findByTestId(knownTestId);

//                return { deviceInterfaceMapping, testCreationRules: Array.isArray(testCreationRules) ? testCreationRules : [] };
//           })();
//      }

//      static async saveProcessedResult(
//           tenantId: number,
//           knownTestId: number,
//           ascensionId: number,
//           employeeid: number,
//           obxResults: Array<{ fieldid: number; value: string; originalvalue: string; field: string; entrymode: string }>,
//           billingid: number,
//           getMappingInformatoion: any
//      ): Promise<{
//           status: "success" | "error";
//           message: string;
//           ascensionInformation?: any;
//           getMappingInformatoion?: any;
//           obxResults?: Array<{ fieldid: number; value: string; originalvalue: string; field: string; entrymode: string }>;
//      }> {
//           const comments = '';
//           const csvid = PRIME_LAB_SYS_DEVICE_CONFIG.CSVID_PREFIX + billingid.toString();
//           const drugs = [] as any[];

//           const patientInfo = await new TiifuWorkingClass('billing').findOne(tenantId, 'billingid', billingid);
//           if (!patientInfo) throw new Error("Patient ID not found for the provided billing ID");

//           const patientid = patientInfo.patientid;
//           const ptid = PRIME_LAB_SYS_DEVICE_CONFIG.PTID_PREFIX + patientid.toString();

//           const finalData = { testid: knownTestId, ascensionid: ascensionId, isScan: false, csvid, ptid, comments, drugs, employeeid, fields: obxResults, hasDrugs: false };
//           const resultEntry = await new Creator(knownTestId).resultEntry(tenantId, finalData as any);

//           return {
//                status: resultEntry ? "success" : "error",
//                message: "Data processed successfully",
//                getMappingInformatoion,
//                obxResults
//           };
//      }

//      static async bioLabDeviceProcessor(tenantId: number, payload: BioLabInterfacingMessage, employeeid: number): Promise<{
//           status: "success" | "error";
//           message: string;
//           ascensionInformation?: any;
//           getMappingInformatoion?: any;
//           obxResults?: Array<{
//                fieldid: number;
//                value: string;
//                originalvalue: string;
//                field: string;
//                entrymode: string;
//           }>;
//      }> {
//           try {
//                const { ascensionId, employeeid } = this.validatePatientId(payload.PatientID);

//                const ascensionInformation = await TestAscension.findAscension(tenantId, ascensionId);

//                if (!ascensionInformation) throw new Error("Ascension information not found");
//                const knownTestId = ascensionInformation.testid;

//                const { deviceInterfaceMapping, testCreationRules } = await this.getDeviceInterfaceData(knownTestId, tenantId);

//                const obxResults: Array<{ fieldid: number; value: string; originalvalue: string; field: string; entrymode: string }> = [];

//                if (deviceInterfaceMapping && typeof deviceInterfaceMapping === 'object') {
//                     for (const [deviceCode, mappedAnalyte] of Object.entries(deviceInterfaceMapping)) {
//                          const fieldIdNumber = Number(deviceCode);
//                          const rule = Array.isArray(testCreationRules) ? testCreationRules.find(r => r.id === fieldIdNumber) : undefined;

//                          const matchedResult = payload.Results.find((result) => {
//                               const mappedValue = String(mappedAnalyte).trim();
//                               return (
//                                    result.Code === mappedValue ||
//                                    result.Name === mappedValue ||
//                                    result.Code === String(fieldIdNumber) ||
//                                    result.Name === String(fieldIdNumber)
//                               );
//                          });

//                          if (!matchedResult) continue;

//                          obxResults.push({
//                               fieldid: fieldIdNumber,
//                               value: matchedResult.Value,
//                               originalvalue: matchedResult.Value,
//                               field: rule?.name || matchedResult.Name || '',
//                               entrymode: 'automatic'
//                          });
//                     }
//                }

//                if (obxResults.length == 0) throw new Error("No matching results found for the provided device interface mapping");

//                const { billingid } = ascensionInformation;
//                const result = await this.saveProcessedResult(
//                     tenantId,
//                     knownTestId,
//                     ascensionId,
//                     employeeid,
//                     obxResults,
//                     billingid,
//                     deviceInterfaceMapping
//                );

//                return {
//                     ...result,
//                     ascensionInformation
//                };


//           } catch (error) {
//                console.error("Error processing bio lab device:", error);
//                throw error;
//           }

//      }


//      static async MindRayDeviceBClassProcessor(payload: IInterfacingDevicePayload) {
//           const obxSegments = payload.data.filter(seg => {
//                if (seg.SEGMENT !== 'OBX') return false;
//                // Fallback: treat OBSERVATION_ID as OBSERVATION_SUB_ID if OBSERVATION_SUB_ID is empty
//                if (!seg.OBSERVATION_SUB_ID || seg.OBSERVATION_SUB_ID.trim() === "") {
//                     seg.OBSERVATION_SUB_ID = seg.OBSERVATION_ID;
//                }
//                // If OBSERVATION_SUB_ID contains ^, pick the middle value
//                if (typeof seg.OBSERVATION_SUB_ID === 'string' && seg.OBSERVATION_SUB_ID.includes('^')) {
//                     const parts = seg.OBSERVATION_SUB_ID.split('^');
//                     if (parts.length >= 3) {
//                          seg.OBSERVATION_SUB_ID = parts[1]; // pick the middle value
//                     } else if (parts.length === 2) {
//                          seg.OBSERVATION_SUB_ID = parts[1]; // fallback to second value
//                     } // else leave as is
//                }
//                return true;
//           }) as IObxSegment[];
//      }
// }


// export default DeviceModelsVersionProcessing;