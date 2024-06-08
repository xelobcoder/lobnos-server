export type practioner = {
  username: string;
  employeeid: number;
};

export type TAppointment = {
  purpose: string;
  appointment_time: string;
  location: string;
  patientid: number;
  title: string;
  preference: string;
  inviteMethod: string;
  duration: number;
  practioner: practioner;
  appointment_date: string;
};


