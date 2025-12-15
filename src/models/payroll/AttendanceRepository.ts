import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';
import { z } from 'zod';

export interface IAttendance {
     id?: number;
     employeeid: number;
     attendance_date: string;
     clock_in?: string;
     clock_out?: string;
     total_hours?: number;
     shift_type: 'regular' | 'night' | 'weekend' | 'holiday';
     work_location: 'on-site' | 'remote' | 'field';
     status: 'present' | 'absent' | 'half_day' | 'late' | 'early_departure';
     late_minutes: number;
     overtime_hours: number;
     overtime_approved: boolean;
     overtime_approved_by?: number | null;
     remarks?: string;
     created_at?: string;
     created_by_name?: string;
     overtime_approver_name?: string;
     updated_at?: string;
}

const attendanceSchema = z.object({
     employeeid: z.number().positive('Employee ID must be a positive number'),
     attendance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Attendance date must be in YYYY-MM-DD format'),
     clock_in: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Clock in time must be in HH:MM or HH:MM:SS format').optional(),
     clock_out: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Clock out time must be in HH:MM or HH:MM:SS format').optional(),
     total_hours: z.number().min(0, 'Total hours cannot be negative').max(24, 'Total hours cannot exceed 24').optional(),
     shift_type: z.enum(['regular', 'night', 'weekend', 'holiday']),
     work_location: z.enum(['on-site', 'remote', 'field']),
     status: z.enum(['present', 'absent', 'half_day', 'late', 'early_departure']),
     late_minutes: z.number().min(0, 'Late minutes cannot be negative').max(1440, 'Late minutes cannot exceed 24 hours'),
     overtime_hours: z.number().min(0, 'Overtime hours cannot be negative').max(24, 'Overtime hours cannot exceed 24'),
     overtime_approved: z.boolean(),
     overtime_approved_by: z.number().positive('Overtime approver ID must be a positive number').nullable().optional(),
     remarks: z.string().max(500, 'Remarks cannot exceed 500 characters').optional()
}).refine((data) => {
     if (data.overtime_approved && (!data.overtime_approved_by || data.overtime_approved_by <= 0)) {
          return false;
     }
     return true;
}, {
     message: 'Overtime approver is required when overtime is approved',
     path: ['overtime_approved_by']
});

export class AttendanceRepository {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     private parseAttendanceRecord(record: any): IAttendance {
          return {
               id: record.id ? Number(record.id) : undefined,
               employeeid: Number(record.employeeid),
               attendance_date: String(record.attendance_date),
               clock_in: record.clock_in ? this.extractTimeFromDateTime(record.clock_in) : undefined,
               clock_out: record.clock_out ? this.extractTimeFromDateTime(record.clock_out) : undefined,
               total_hours: record.total_hours ? Number(record.total_hours) : undefined,
               shift_type: record.shift_type,
               work_location: record.work_location,
               status: record.status,
               late_minutes: Number(record.late_minutes),
               overtime_hours: Number(record.overtime_hours),
               overtime_approved: Boolean(record.overtime_approved),
               overtime_approved_by: record.overtime_approved_by ? Number(record.overtime_approved_by) : null,
               remarks: record.remarks || undefined,
               created_at: record.created_at,
               created_by_name: record.created_by_name,
               overtime_approver_name: record.overtime_approver_name || "",
               updated_at: record.updated_at
          };
     }

     private extractTimeFromDateTime(dateTime: string | Date): string {
          if (!dateTime) return '';

          if (typeof dateTime === 'string' && /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(dateTime)) {
               return dateTime;
          }

          const date = new Date(dateTime);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds();

          return seconds > 0 ? `${hours}:${minutes}:${seconds.toString().padStart(2, '0')}` : `${hours}:${minutes}`;
     }

     async create(attendance: IAttendance): Promise<number> {
          attendanceSchema.parse(attendance);

          const connection = await this.connection;

          const existing = await this.getByEmployeeAndDate(attendance.employeeid, attendance.attendance_date);

          const dataToInsert = { ...attendance };

          if (existing) {
               await connection('payroll_employee_attendance')
                    .where({ employeeid: attendance.employeeid, attendance_date: attendance.attendance_date })
                    .update({ ...dataToInsert, updated_at: connection.fn.now() });
               return existing.id!;
          } else {
               const [id] = await connection('payroll_employee_attendance').insert(dataToInsert);
               return id;
          }
     }

     async getById(id: number): Promise<IAttendance | undefined> {
          const connection = await this.connection;
          const record = await connection('payroll_employee_attendance')
               .leftJoin('roles', 'payroll_employee_attendance.overtime_approved_by', 'roles.employeeid')
               .leftJoin('roles as creator ', 'payroll_employee_attendance.employeeid', 'creator.employeeid')
               .select(
                    'payroll_employee_attendance.*',
                    'roles.username as overtime_approver_name',
                    'creator.username as created_by_name'
               )
               .where({ id }).first();
          return record ? this.parseAttendanceRecord(record) : undefined;
     }

     async getByEmployeeAndDate(
          employeeid: number,
          attendance_date: string
     ): Promise<IAttendance | undefined> {
          const connection = await this.connection;
          const record = await connection('payroll_employee_attendance')
               .where({ employeeid, attendance_date })
               .first();
          return record ? this.parseAttendanceRecord(record) : undefined;
     }

     async getByEmployeeIdAndDateRange(
          employeeid: number,
          startDate: string,
          endDate: string
     ): Promise<IAttendance[]> {
          const connection = await this.connection;
          const records = await connection('payroll_employee_attendance')
               .where({ employeeid })
               .whereBetween('attendance_date', [startDate, endDate])
               .orderBy('attendance_date', 'asc');
          return records.map(record => this.parseAttendanceRecord(record));
     }

     async update(id: number, attendance: Partial<IAttendance>): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid attendance ID is required for update');
          }

          const existing = await this.getById(id);
          if (!existing) {
               throw new Error('Attendance record not found');
          }

          const cleanedExisting = {
               ...existing,
               remarks: existing.remarks ?? undefined,
               overtime_approved_by: existing.overtime_approved_by ?? undefined
          };

          const completeAttendance = { ...cleanedExisting, ...attendance };

          attendanceSchema.parse(completeAttendance);

          const connection = await this.connection;

          const dataToUpdate = { ...attendance };

          const affectedRows = await connection('payroll_employee_attendance')
               .where({ id })
               .update({ ...dataToUpdate, updated_at: connection.fn.now() });
          return affectedRows > 0;
     }

     async getByDateRange(startDate: string, endDate: string): Promise<IAttendance[]> {
          if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
               throw new Error('Valid start date is required in YYYY-MM-DD format');
          }

          if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
               throw new Error('Valid end date is required in YYYY-MM-DD format');
          }

          if (new Date(startDate) > new Date(endDate)) {
               throw new Error('Start date cannot be after end date');
          }

          const connection = await this.connection;
          const records = await connection('payroll_employee_attendance')
               .whereBetween('attendance_date', [startDate, endDate])
               .orderBy('attendance_date', 'asc');
          return records.map(record => this.parseAttendanceRecord(record));
     }

     async getAttendanceSummary(
          employeeid: number,
          startDate: string,
          endDate: string
     ): Promise<{
          total_days: number;
          present_days: number;
          absent_days: number;
          half_days: number;
          late_days: number;
          total_hours: number;
          overtime_hours: number;
     }> {
          if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
               throw new Error('Valid employee ID is required');
          }

          if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
               throw new Error('Valid start date is required in YYYY-MM-DD format');
          }

          if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
               throw new Error('Valid end date is required in YYYY-MM-DD format');
          }

          if (new Date(startDate) > new Date(endDate)) {
               throw new Error('Start date cannot be after end date');
          }

          const connection = await this.connection;

          const result = await connection('payroll_employee_attendance')
               .where({ employeeid })
               .whereBetween('attendance_date', [startDate, endDate])
               .select(
                    connection.raw('COUNT(*) as total_days'),
                    connection.raw("SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days"),
                    connection.raw("SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days"),
                    connection.raw("SUM(CASE WHEN status = 'half-day' THEN 1 ELSE 0 END) as half_days"),
                    connection.raw("SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days"),
                    connection.raw('COALESCE(SUM(total_hours), 0) as total_hours'),
                    connection.raw('COALESCE(SUM(overtime_hours), 0) as overtime_hours')
               )
               .first() as any;

          return {
               total_days: Number(result?.total_days || 0),
               present_days: Number(result?.present_days || 0),
               absent_days: Number(result?.absent_days || 0),
               half_days: Number(result?.half_days || 0),
               late_days: Number(result?.late_days || 0),
               total_hours: Number(result?.total_hours || 0),
               overtime_hours: Number(result?.overtime_hours || 0)
          };
     }

     async clockIn(employeeid: number, attendance_date: string, clock_in: string): Promise<number> {
          if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
               throw new Error('Valid employee ID is required');
          }

          if (!attendance_date || typeof attendance_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)) {
               throw new Error('Valid attendance date is required in YYYY-MM-DD format');
          }

          if (!clock_in || typeof clock_in !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(clock_in)) {
               throw new Error('Valid clock in time is required in HH:MM or HH:MM:SS format');
          }

          const connection = await this.connection;

          const existing = await this.getByEmployeeAndDate(employeeid, attendance_date);

          if (existing) {
               await connection('payroll_employee_attendance')
                    .where({ employeeid, attendance_date })
                    .update({
                         clock_in: clock_in,
                         updated_at: connection.fn.now()
                    });
               return existing.id!;
          } else {
               return this.create({
                    employeeid,
                    attendance_date,
                    clock_in,
                    shift_type: 'regular',
                    work_location: 'on-site',
                    status: 'present',
                    late_minutes: 0,
                    overtime_hours: 0,
                    overtime_approved: false
               });
          }
     }

     async clockOut(
          employeeid: number,
          attendance_date: string,
          clock_out: string,
          total_hours: number
     ): Promise<boolean> {
          if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
               throw new Error('Valid employee ID is required');
          }

          if (!attendance_date || typeof attendance_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)) {
               throw new Error('Valid attendance date is required in YYYY-MM-DD format');
          }

          if (!clock_out || typeof clock_out !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(clock_out)) {
               throw new Error('Valid clock out time is required in HH:MM:SS format');
          }

          if (!total_hours || typeof total_hours !== 'number' || total_hours < 0 || total_hours > 24) {
               throw new Error('Total hours must be a number between 0 and 24');
          }

          const connection = await this.connection;

          const regularHours = 8;
          const overtimeHours = Math.max(0, total_hours - regularHours);

          const affectedRows = await connection('payroll_employee_attendance')
               .where({ employeeid, attendance_date })
               .update({
                    clock_out: clock_out,
                    total_hours,
                    overtime_hours: overtimeHours,
                    updated_at: connection.fn.now()
               });

          return affectedRows > 0;
     }

     async getPendingOvertimeApprovals(): Promise<IAttendance[]> {
          const connection = await this.connection;
          const records = await connection('payroll_employee_attendance')
               .where({ overtime_approved: false })
               .where('overtime_hours', '>', 0)
               .orderBy('attendance_date', 'desc');
          return records.map(record => this.parseAttendanceRecord(record));
     }

     async approveOvertime(id: number, approved_by: number): Promise<boolean> {
          if (!id || typeof id !== 'number' || id <= 0) {
               throw new Error('Valid attendance ID is required');
          }

          if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
               throw new Error('Valid approver ID is required');
          }

          const connection = await this.connection;
          const affectedRows = await connection('payroll_employee_attendance')
               .where({ id })
               .update({
                    overtime_approved: true,
                    overtime_approved_by: approved_by,
                    updated_at: connection.fn.now()
               });
          return affectedRows > 0;
     }

     async bulkCreate(attendanceRecords: IAttendance[]): Promise<number[]> {
          if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
               throw new Error('Attendance records array is required and cannot be empty');
          }

          for (const record of attendanceRecords) {
               attendanceSchema.parse(record);
          }

          const connection = await this.connection;
          const dataToInsert = attendanceRecords.map(record => {
               const data = { ...record };
               return data;
          });

          return connection('payroll_employee_attendance').insert(dataToInsert);
     }
}
