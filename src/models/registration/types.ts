export type NewRegistration = {
  firstname: string;
  lastname: string;
  middlename: string;
  age: string;
  ageType: string;
  email: string;
  gender: string;
  mobile: number;
  designation: string;
  days: number;
  relativecontactnumber: (string | number);
  relativecontactname: string;
  fullpatientid: string;
  months: number;
  maritalstatus: boolean;
  employeeid: number;
  occupation: string;
  patientOrganization: string;
  years: number;
  whatAppcontact: (string | number);
  mobileownership: string;
  mobileCountryCode: string;
  whatsappCountryCode: string;
  relativeCountryCode: string;
};

export type clientdata = {
  mobile: number;
  mobileownership: string;
  email: string;
};

export type registrationOutcome = {
  count: number;
  insertid: number;
};

export type addressInformation = {
  area: string;
  region: string;
  gpsLocation: string;
  address: string;
};

export interface IRegistration {
  patientid: number;
  isClientSame(clientdata: clientdata): boolean;
  checkEmailOrMobileExist(email: string, mobile: number): boolean;
  checkPatientIdExist(patientid: number): Promise<boolean>;
  getPatientBasicData(patientid: number | string): Promise<NewRegistration | null>;
  addPersonalInformation(records: NewRegistration): Promise<number | void>;
  addressingInformation(paientid: number, records: addressInformation): Promise<boolean | void>;
  addNewPatient(data: NewRegistration): Promise<number>;
  updatePersonalInformation(patientdata: NewRegistration): Promise<boolean>;
}

export type PatientRecords = {
  count: number;
  email: string;
  patientid: number;
  page: number;
  tenantId: string;
  from: string;
  to: string;
  sortby: 'DESC' | 'ASC';
  fullname: string;
  mobile: number;
};
