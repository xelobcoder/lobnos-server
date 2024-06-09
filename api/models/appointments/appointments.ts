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
    return Array.isArray(rows) && rows.length > 0 ? false : true;
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

  public async getPatientAppointmentHistory(patientid: number, count: number = 10, page: number = 1) {
    const query = `SELECT 
    a.appointment_date,
    a.appointment_time,
    a.duration,
    a.preference,
    a.inviteMethod,
    a.purpose,
    a.location,
    a.title,
    a.status,
    r.username AS practioner
    FROM appointments AS a INNER JOIN roles AS r
    ON a.practioner = r.employeeid
    WHERE a.patientid = ? ORDER BY a.refid DESC LIMIT ? OFFSET ?`;
    return await promisifyQuery(query, [patientid, count, page]);
  }

  public async loadMonthAppointments(month: number | string) {
    var searchMonth = month;
    if (typeof month == "string") {
      const months = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
      };
      searchMonth = months[month];
    }

    if (searchMonth != undefined) {
      const q = `SELECT * FROM appointments WHERE MONTH(appointment_date) = ?`;
      return await this.connection(q, [month]);
    }
    return [];
  }
}

export default Appointment;
