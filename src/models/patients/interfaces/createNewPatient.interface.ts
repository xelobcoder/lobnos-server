import { Designation } from "../dto/newPatientDto";

export interface ICreateNewPatient {
     contact_relationship?: string;
     backup_phone?: string;
     backup_contact_name?: string;
     backup_relationship?: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  designation: Designation;
  email?: string;
  dob?: string;
  age: number;
  agetype: "day" | "days" | "months" | "years";
  gender: "male" | "female";
  marital_status?: "single" | "married";
  mobile_number?: string;
  whatAppcontact?: string;
  contact_pointer: "self" | "relative";
  occupation?: string;
  organization?: string;
  contactpointer?: "self" | "relative";
  registeredby: number;
  relativecontactname?: string;
  relativecontactnumber?: string;
  whatsapp_country_code?: string;
  mobile_country_code?: string;
}



