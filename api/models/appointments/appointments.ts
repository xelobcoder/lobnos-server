import { promisifyQuery, rowAffected } from "../../../helper";
import { TAppointment } from "./appointmentTypes";

class Appointment {
  employeeid: number;
  private connection = promisifyQuery;
  private _affectedRows = rowAffected;
  constructor(employeeid: number) {
    this.employeeid = employeeid;
  }

  private async isAppointmentTimeAvailable(date: string, time: string) {
    let refined_date: string = date;
    if (refined_date.includes("T")) {
      refined_date = refined_date.split("T")[0];
    }
    const _mysql_query = `SELECT * FROM appointments WHERE appointment_date = ? AND appointment_time = ?`;
    const rows = await this.connection(_mysql_query, [refined_date, time]);
    return Array.isArray(rows) && rows.length > 0;
  }
  public async createAppointment(data: TAppointment) {
    const { patientid, duration, appointment_date, appointment_time, inviteMethod, purpose, title, preference, practioner, location } =
      data;
    if (!patientid) {
      throw new Error("patientid missing");
    }

    if (!(await this.isAppointmentTimeAvailable(appointment_date, appointment_time))) {
      return false;
    }
    const createQuery = `INSERT INTO appointments(patientid,duration,appointment_time,appointment_date,inviteMethod,purpose,title,preference,practioner,location) VALUES(?,?,?,?,?,?,?,?,?,?)`;

    const result = await this.connection(createQuery, [
      patientid,
      duration,
      appointment_time,
      appointment_date,
      inviteMethod,
      purpose,
      title,
      preference,
      practioner,
      location,
    ]);

    return this._affectedRows(result);
  }

  public async getPatientAppointmentHistory(patientid: number) {
    
  }
}

export default Appointment;
