import KnexConnection from "../../database/KnexConnections";

interface Shift {
     id?: number;
     name: string;
     color?: string;
     starttime: string;
     endtime: string;
}

class ShiftService {
     static async createShift(tenantId: number, shift: Shift): Promise<Shift> {
          const connection = await KnexConnection(tenantId);
          await connection("shifts")
               .insert(shift)
               .onConflict("name")
               .merge();
          return shift;
     }

     static async getAllShifts(
          tenantId: number,
          query?: { sortby?: 'DESC' | 'ASC', page?: number, count?: number }
     ): Promise<Shift[]> {
          const { page = 1, count = 20, sortby = 'DESC' } = query || {};
          const connection = await KnexConnection(tenantId);
          return await connection("shifts")
               .select("*")
               .orderBy("id", sortby)
               .limit(count)
               .offset((page - 1) * count);
     }

     static async getShiftById(tenantId: number, id: number): Promise<Shift | undefined> {
          const connection = await KnexConnection(tenantId);
          return await connection("shifts").where({ id }).first();
     }

     static async updateShift(tenantId: number, id: number, updates: Partial<Shift>) {
          const connection = await KnexConnection(tenantId);
          const updated = await connection("shifts").where({ id }).update(updates);
          return updated ? { id, ...updates } : null;
     }

     static async deleteShift(tenantId: number, id: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection("shifts").where({ id }).del();
     }

     static async loadDefaultShifts(tenantId: number): Promise<void> {
          const connection = await KnexConnection(tenantId);
          const defaultShifts: Shift[] = [
               {
                    name: "Morning",
                    color: "#FFA500",
                    starttime: "08:00:00",
                    endtime: "12:00:00"
               },
               {
                    name: "Afternoon",
                    color: "#008000",
                    starttime: "13:00:00",
                    endtime: "17:00:00"
               },
               {
                    name: "Evening",
                    color: "#0000FF",
                    starttime: "18:00:00",
                    endtime: "22:00:00"
               }
          ];

          const existingShifts = await connection("shifts")
               .select("name")
               .whereIn("name", defaultShifts.map(shift => shift.name));

          const existingShiftNames = existingShifts.map((shift: any) => shift.name);

          for (const shift of defaultShifts) {
               if (!existingShiftNames.includes(shift.name)) {
                    await connection("shifts").insert(shift);
               }
          }
     }
}

export default ShiftService;
