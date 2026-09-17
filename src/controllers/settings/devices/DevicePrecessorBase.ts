import { TiifuWorkingClass } from "../../../database/TiifuWorkingClass";
import Creator from "../../../models/creator/creator";
import { TestAscension } from "../../../models/operations/ascension";
import TestCreationRulesRepository from "../../../models/TestCreation/TestCreationRulesRepository";
import { testpanel } from "../../../testpanel/testpanelList";
import { PRIME_LAB_SYS_DEVICE_CONFIG } from "./constants/config";

export interface IObxResult {
     fieldid: number;
     value: string;
     originalvalue: string;
     field: string;
     entrymode: string;
}

export interface IDeviceProcessResult {
     status: "success" | "error";
     message: string;
     ascensionInformation?: any;
     getMappingInformatoion?: any;
     obxResults?: IObxResult[];
}

export interface IDeviceInterfaceData {
     deviceInterfaceMapping: Record<string, any> | null;
     testCreationRules: any[];
}

abstract class DeviceProcessorBase<TPayload> {
     protected readonly tenantId: number;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
     }

     // ------------------------------------------------------------------
     // PRE-PROCESSING
     // ------------------------------------------------------------------

     protected validatePatientId(patientId: string): { ascensionId: number; employeeid: number } {
          if (!patientId) {
               throw new Error("Patient ID is missing or invalid in the payload");
          }

          const splitedPatientId = patientId.split('-');
          if (splitedPatientId.length !== 2) {
               throw new Error("Patient ID format is invalid. Expected format: ascensionId-employeeId");
          }

          if (splitedPatientId.length < 2) {
               throw new Error("Patient ID format is invalid. Expected format: ascensionId-employeeId");
          }

          const ascensionId =  parseInt(splitedPatientId[0], 10);
          const employeeid = parseInt(splitedPatientId[1], 10);

          if (isNaN(ascensionId) || isNaN(employeeid)) {
               throw new Error("Ascension ID or Employee ID is not a valid number");
          }

          return { ascensionId, employeeid };
     }

     protected async resolveAscension(ascensionId: number): Promise<any> {
          const ascensionInformation = await TestAscension.findAscension(this.tenantId, ascensionId);
          if (!ascensionInformation) throw new Error("Ascension information not found");
          return ascensionInformation;
     }

     protected async getDeviceInterfaceData(knownTestId: number): Promise<IDeviceInterfaceData> {
          const getMappingInformatoion = await testpanel.getTestInfo(this.tenantId, knownTestId);

          if (!getMappingInformatoion) {
               throw new Error("Test information not found for the provided test ID");
          }

          const deviceInterfaceMapping = getMappingInformatoion['deviceInterfaceMapping'] != null ?
               typeof getMappingInformatoion['deviceInterfaceMapping'] === 'string' ?
                    JSON.parse(getMappingInformatoion['deviceInterfaceMapping']) :
                    getMappingInformatoion['deviceInterfaceMapping']
               : null;

          const testCreationRules = await new TestCreationRulesRepository(this.tenantId).findByTestId(knownTestId);

          return {
               deviceInterfaceMapping,
               testCreationRules: Array.isArray(testCreationRules) ? testCreationRules : []
          };
     }

     // ------------------------------------------------------------------
     // POST-PROCESSING
     // ------------------------------------------------------------------

     protected async saveProcessedResult(
          knownTestId: number,
          ascensionId: number,
          employeeid: number,
          obxResults: IObxResult[],
          billingid: number,
          getMappingInformatoion: any
     ): Promise<IDeviceProcessResult> {
          const comments = '';
          const csvid = PRIME_LAB_SYS_DEVICE_CONFIG.CSVID_PREFIX + billingid.toString();
          const drugs = [] as any[];

          const patientInfo = await new TiifuWorkingClass('billing').findOne(this.tenantId, 'billingid', billingid);
          if (!patientInfo) throw new Error("Patient ID not found for the provided billing ID");

          const patientid = patientInfo.patientid;
          const ptid = PRIME_LAB_SYS_DEVICE_CONFIG.PTID_PREFIX + patientid.toString();

          const finalData = {
               testid: knownTestId,
               ascensionid: ascensionId,
               isScan: false,
               csvid,
               ptid,
               comments,
               drugs,
               employeeid,
               fields: obxResults,
               hasDrugs: false
          };

          console.log(finalData)
          
          const resultEntry = await new Creator(knownTestId).resultEntry(this.tenantId, finalData as any);

          return {
               status: resultEntry ? "success" : "error",
               message: "Data processed successfully",
               getMappingInformatoion,
               obxResults
          };
     }

     // ------------------------------------------------------------------
     // HOOKS - this is what a device processor actually owns
     // ------------------------------------------------------------------

     /** Pull the raw patient id string out of this device's payload shape. */
     protected abstract extractPatientId(payload: TPayload): string 

     /**
      * THE OBX PROCESSING. Turn the device's raw result payload into the
      * normalized obx result rows, using the tenant's device -> field
      * mapping and test creation rules. This is the only piece of
      * business logic each device processor should need to write.
      */
     protected abstract buildObxResults(
          payload: TPayload,
          deviceInterfaceMapping: Record<string, any> | null,
          testCreationRules: any[]
     ): IObxResult[] | Promise<IObxResult[]>;

     // ------------------------------------------------------------------
     // TEMPLATE METHOD
     // ------------------------------------------------------------------

     async process(payload: TPayload): Promise<IDeviceProcessResult & { ascensionInformation?: any }> {
          try {
               let ascensionId: number | undefined = undefined;
               let employeeid: number | undefined = undefined;

               console.log("Processing payload:", payload);
           
               if (payload && typeof payload === 'object' && !ascensionId && !employeeid) {
                    const data = this.validatePatientId(this.extractPatientId(payload));
                    ascensionId = data.ascensionId;
                    employeeid = data.employeeid; 
               }

               const ascensionInformation = await this.resolveAscension(ascensionId as any);
               const knownTestId = ascensionInformation.testid;

               const { deviceInterfaceMapping, testCreationRules } = await this.getDeviceInterfaceData(knownTestId);

               const obxResults = await this.buildObxResults(payload, deviceInterfaceMapping, testCreationRules);

               if (!obxResults || obxResults.length === 0) {
                    throw new Error("No matching results found for the provided device interface mapping");
               }

               const { billingid } = ascensionInformation;
               const result = await this.saveProcessedResult(
                    knownTestId,
                    ascensionId,
                    employeeid,
                    obxResults,
                    billingid,
                    deviceInterfaceMapping
               );

               return { ...result, ascensionInformation };
          } catch (error) {
               throw error;
          }
     }
}

export default DeviceProcessorBase;