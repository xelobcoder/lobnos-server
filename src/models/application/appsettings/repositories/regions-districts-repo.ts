import KnexConnection from "../../../../database/KnexConnections";
import { PrimeLimsTabledistricts, PrimeLimsTableregions } from "../../../../database/DatabaseTableSchema";
import { REGIONS } from "../constants/regions";
import { DISTRICTS, DISTRICT_ABBREVIATIONS } from "../constants/districts";

export default class RegionsDistrictsRepository {
     async hasRegionsAndDistrictsTables(tenantId: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const hasRegionsTable = await connection.schema.hasTable("regions");
          const hasDistrictsTable = await connection.schema.hasTable("districts");
          return hasRegionsTable && hasDistrictsTable;
     }

     async regionsAndDistrictsHaveData(tenantId: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const [regionsCount] = await connection("regions").count({ count: "*" });
          const [districtsCount] = await connection("districts").count({ count: "*" });
          return Number(regionsCount.count) > 0 && Number(districtsCount.count) > 0;
     }

     async createRegionsAndDistrictsTables(tenantId: number): Promise<void> {
          const connection = await KnexConnection(tenantId);
          await connection.schema.createTable("regions", (table) => {
               table.increments("id").primary();
               table.string("name").notNullable();
               table.string("regioncode").notNullable().unique();
          });

          await connection.schema.createTable("districts", (table) => {
               table.increments("id").primary();
               table.string("name").notNullable();
               table.string("code").notNullable();
               table.integer("regionid").unsigned().notNullable();
               table.foreign("regionid").references("regions.id");
               table.unique(["code", "regionid"]);
          });
     }

     async seedRegionsAndDistricts(tenantId: number): Promise<void> {
          const connection = await KnexConnection(tenantId);

          await connection("regions")
               .insert(REGIONS)
               .onConflict(["regioncode"])
               .merge();

          const regions = await connection("regions").select("*").orderBy("regioncode");

          const regionMap: Record<string, number> = {};
          regions.forEach(region => {
               regionMap[region.regioncode] = region.id;
          });

          const districtsToInsert = DISTRICTS.map(district => {
               const firstLetter = district.code.charAt(0);
               const regionCode = DISTRICT_ABBREVIATIONS[firstLetter];
               const regionid = regionMap[regionCode];
               return {
                    name: district.name,
                    code: district.code,
                    regionid: regionid
               };
          });

          await connection("districts")
               .insert(districtsToInsert)
               .onConflict(["code", "regionid"])
               .merge();
     }

     async getApplicationSettingsRegionDistrictCode(tenantId: number): Promise<{ regioncode: number, districtcode: number } | undefined> {
          const connection = await KnexConnection(tenantId);
          return connection("applicationsettings")
               .select(["regioncode", "districtcode"])
               .where("keyid", 1)
               .first();
     }

     async insertApplicationSettingsRegionDistrictCode(tenantId: number, regioncode: number, districtcode: number): Promise<void> {
          const connection = await KnexConnection(tenantId);
          await connection("applicationsettings").insert({
               keyid: 1,
               regioncode,
               districtcode
          });
     }

     async getMergedRegionAndDistrict(tenantId: number, codeValues: { regioncode: string, districtcode: string }): Promise<(PrimeLimsTableregions & PrimeLimsTabledistricts) | undefined> {
          const connection = await KnexConnection(tenantId);
          return connection("districts")
               .join("regions", "regions.id", "districts.regionid")
               .where({ "districts.regionid": codeValues.regioncode, "districts.id": codeValues.districtcode })
               .select("*")
               .first();
     }
}
