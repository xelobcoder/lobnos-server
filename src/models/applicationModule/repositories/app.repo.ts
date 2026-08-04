import { Knex } from "knex";
import KnexConnection from "../../../database/KnexConnections";

class ApplicationGeneralSettingsRepository {

     private connection: Promise<Knex>;
     private tenantId: number;
     private tableName: string;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
          this.tableName = "applicationsettings";
     }
}