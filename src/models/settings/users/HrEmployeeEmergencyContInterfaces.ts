export type AuthenticationMethod = 'password' | 'sms' | 'email';
export type AccountStatus = 'Active' | 'Inactive' | 'Locked';

export interface HrEmployeeLoginCredentials {
  credentialid: number;
  employeeid: number;
  password: string;
  pin?: number;
  authenticationmethod: AuthenticationMethod;
  accountstatus: AccountStatus;
  activation: boolean;
  refreshtoken?: string;
  lastlogin?: string; // or Date if you use Date objects
  emailauthenticated: boolean;
  datecreated?: string;
  timecreated?: string;
  updatedon?: string;
}

export interface HrEmployeeEmergencyContact {
  contactid: number;
  employeeid: number;
  contactname: string;
  relationship?: string;
  contactphone?: string;
  contactemail?: string;
}

export interface HrRolesPermissions {
  roleid: number;
  employeeid: number;
  rolename: string;
  permissions: any;
  accessrights?: string;
}