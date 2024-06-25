import { q_new_registation, q_patient_data } from "./queries";
import { addressInformation, clientdata, IRegistration, NewRegistration, registrationOutcome } from "./types";

const { customError, promisifyQuery, rowAffected } = require("../../../../helpers");

export class Registration implements IRegistration {
  patientid: number;
  isClientSame(clientdata: clientdata): boolean {
    throw new Error("Method not implemented.");
  }
  checkEmailOrMobileExist(email: string, mobile: number): boolean {
    throw new Error("Method not implemented.");
  }
  public async checkPatientIdExist(patientid: number): Promise<boolean> {
    try {
      let useKey;
      useKey = patientid ? patientid : this.patientid;
      let result = await promisifyQuery(q_patient_data, useKey);
      return result.length > 0;
    } catch (err) {
      return false;
    }
  }
  getPatientBasicData(): Promise<[]> {
    throw new Error("Method not implemented.");
  }
  public async addPersonalInformation(records: NewRegistration): Promise<registrationOutcome | void> {
    const {
      firstname,
      lastname,
      middlename,
      age,
      ageType,
      gender,
      email,
      mobile,
      days,
      months,
      maritalstatus,
      occupation,
      patientOrganization,
      years,
      mobileownership = "self",
    } = records;

    const values = [
      firstname,
      lastname,
      middlename,
      email,
      age,
      ageType,
      `${years}-${months}-${days}`,
      maritalstatus,
      mobile,
      occupation,
      gender,
      patientOrganization,
      mobileownership,
    ];

    const result = await promisifyQuery(q_new_registation, values);
    return { count: result.affectedRows, insertid: result.insertId };
  }
  addressingInformation(paientid: number, records: addressInformation): Promise<boolean | void> {
    throw new Error("Method not implemented.");
  }
  addNewPatient(data: NewRegistration): Promise<number> {
    throw new Error("Method not implemented.");
  }
  updatePersonalInformation(patientdata: NewRegistration): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
