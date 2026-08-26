import RegionsDistrictsRepository from "../repositories/regions-districts-repo";
import { PATIENT_REGISTRATION_FAILURES } from "../../../patients/enums/Failures.Patient.enum";

export default class RegionsDistrictsService {
     private repo = new RegionsDistrictsRepository();

     async ensureTablesAndSeedExist(tenantId: number): Promise<void> {
          const hasTables = await this.repo.hasRegionsAndDistrictsTables(tenantId);
          if (!hasTables) await this.repo.createRegionsAndDistrictsTables(tenantId);
          const hasData = await this.repo.regionsAndDistrictsHaveData(tenantId);
          if (!hasData) await this.ensureSeedExists(tenantId);
     }

     async ensureSeedExists(tenantId: number): Promise<boolean> {
          await this.repo.seedRegionsAndDistricts(tenantId);
          return true;
     }

     async getLabRegionalAndDistrictCode(tenantId: number): Promise<{ regioncode: number, districtcode: number }> {
          await this.ensureTablesAndSeedExist(tenantId);
          const existing = await this.repo.getApplicationSettingsRegionDistrictCode(tenantId);
          if (existing) return existing;

          const regioncode = 1;
          const districtcode = 1;
          await this.repo.insertApplicationSettingsRegionDistrictCode(tenantId, regioncode, districtcode);
          return { regioncode, districtcode };
     }

     async getRegionalAndDistrictCodeMergedData(tenantId: number, codeValues: { regioncode: string, districtcode: string }): Promise<{ region: string, district: string } | null> {
          const result = await this.repo.getMergedRegionAndDistrict(tenantId, codeValues);
          if (!result) return null;
          return { region: result.regioncode, district: result.code };
     }

     async getLabRegionalAndDistrictCodeAbbreviations(tenantId: number): Promise<{ region: string, district: string } | null> {
          const codeValues = await this.getLabRegionalAndDistrictCode(tenantId);
          if (!codeValues) throw new Error(PATIENT_REGISTRATION_FAILURES.REGIONAL_OR_DISTRICT_CODE_NOT_FOUND_IN_APPLICATION_SETTINGS);
          return this.getRegionalAndDistrictCodeMergedData(tenantId, codeValues as unknown as { regioncode: string, districtcode: string });
     }
}
