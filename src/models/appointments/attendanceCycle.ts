import KnexConnection from "../../database/KnexConnections";

interface AttendanceCycle {
     id?: number;
     cyclestart: string;
     cycleend: string;
     description?: string;
}

class AttendanceCycleService {
     static async createAttendanceCycle(tenantId: number, cycle: AttendanceCycle): Promise<AttendanceCycle> {
          const connection = await KnexConnection(tenantId);
          const [id] = await connection("attendanceCycles").insert(cycle);
          return { id, ...cycle };
     }

     static async getAllAttendanceCycles(tenantId: number): Promise<AttendanceCycle[]> {
          const connection = await KnexConnection(tenantId);
          return await connection("attendanceCycles").select("*");
     }

     static async getAttendanceCycleById(tenantId: number, id: number): Promise<AttendanceCycle | undefined> {
          const connection = await KnexConnection(tenantId);
          return await connection("attendanceCycles").where({ id }).first();
     }

     static async updateAttendanceCycle(tenantId: number, id: number, updates: Partial<AttendanceCycle>) {
          const connection = await KnexConnection(tenantId);
          return await connection("attendanceCycles").where({ id }).update(updates);
     }

     static async deleteAttendanceCycle(tenantId: number, id: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection("attendanceCycles").where({ id }).del();
     }
}

export default AttendanceCycleService;
