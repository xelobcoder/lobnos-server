// Generated types for database tables

export type PrimeLimsTableaccounts = {
  id: number;
  accountId: string;
  accountName: string;
  type: string;
  isImmutable?: number ;
  normalBalance: string;
  USER?: string ;
  HOST?: string ;
  CURRENT_CONNECTIONS: number;
  TOTAL_CONNECTIONS: number;
};

export type PrimeLimsTableactivation = {
  ID: number;
  STATUS: string;
  PATIENTID: number;
  DATE: Date | string;
  mimi: number;
};

export type PrimeLimsTableadditionalservices = {
  keyid: number;
  serviceName: string;
  servicePrice: number;
  serviceCreatedOn: Date | string;
  serviceUpdatedBy: number;
  createdBy: number;
  serviceUpdatedOn: Date | string;
  issystem: number;
};

export type PrimeLimsTableapplicationsettings = {
  keyid: number;
  bulkregistration: number;
  fontsize: string;
  textcolor: string;
  BackgroundColor: string;
  DeactivateBilling24hrs: number;
  PaidBillsBeforeTransaction: number;
  completeFlow: number;
  approvalbeforeprinting: number;
  smsActivated: number;
  smsSettings: string;
  emailNotification: number;
  includeTax: number;
  patientIdPrefix?: string ;
  fontFamily?: string ;
  billingidPrefix?: string ;
  services?: string ;
  billingsettings?: string ;
  regioncode: number;
  districtcode: number;
};

export type PrimeLimsTableappointments = {
  refid: number;
  patientid: number;
  duration: number;
  status?: string ;
  appointment_time: string;
  appointment_date: Date | string;
  inviteMethod: string;
  purpose: string;
  title: string;
  preference: string;
  practioner: number;
  location: string;
  notes?: string ;
};

export type PrimeLimsTableattendancecycles = {
  id: number;
  cyclestart: Date | string;
  cycleend: Date | string;
  description?: string ;
};

export type PrimeLimsTablebilling = {
  billingid: number;
  patientid: number;
  paid_amount: number;
  payable: number;
  discount: number;
  organization: number;
  clinician: number;
  type: string;
  outstanding: number;
  taxIncluded?: string ;
  taxValue?: number ;
  billedon: Date | string;
  branchid: number;
  clientstatus: string;
  testcost: number;
  employeeid: number;
  year: number;
  month: number;
  day?: number ;
  totalTransactionCost?: number ;
  totalcost: number;
  paid: number;
  totalrefunded: number;
  balance: number;
  amountIncurredDueTax: number;
  lastupdated: Date | string;
};

export type PrimeLimsTablebillinghx = {
  KeyID: number;
  Billingid: number;
  Date: Date | string;
  PaymentMode: number;
  Amount: number;
  employeeid: number;
  type: string;
};

export type PrimeLimsTablebillingstrategy = {
  strategyid: number;
  associatedid: number;
  allconcessionApplied: number;
  concessionMode?: string ;
  applicableOrganization?: string ;
  applicableTest?: string ;
  concessionValue: number;
  createdon: Date | string;
  updatedon?: Date | string ;
  isInsurance: number;
  isClinician: number;
  category: string;
};

export type PrimeLimsTablebillingtemporarytable = {
  orderid: number;
  clinicianid: number;
  organizationid: number;
  data: string;
  created_on: Date | string;
  processed: number;
  patientid: number;
};

export type PrimeLimsTablebilling_audit = {
  audit_id: number;
  billingid?: number ;
  patientid?: number ;
  totalTransactionCost?: number ;
  totalcost?: number ;
  paid?: number ;
  payable?: number ;
  totalrefunded?: number ;
  discount?: number ;
  outstanding?: number ;
  balance?: number ;
  billedon?: Date | string ;
  clientstatus?: string ;
  year?: number ;
  month?: number ;
  day?: number ;
  amountIncurredDueTax?: number ;
  lastupdated: Date | string;
  action_type?: string ;
  action_timestamp?: Date | string ;
  actor?: string ;
};

export type PrimeLimsTablebranch = {
  branchid: number;
  name: string;
  date: Date | string;
  activation: number;
  address?: string ;
  email?: string ;
  contact: number;
  managerid: string;
};

export type PrimeLimsTableclinicianbasicinfo = {
  id: number;
  name: string;
  email: string;
  location: string;
  address: string;
  occupation: string;
  organization: number;
  updated_on?: Date | string ;
  created_on: Date | string;
  phone: number;
  identifier: string;
};

export type PrimeLimsTableclinicianpaymentinfo = {
  ID: number;
  clinicianid: number;
  module: string;
  momo?: number ;
  bankname?: string ;
  bankbranch?: string ;
  accountnumber?: number ;
  accountname?: string ;
  organization: number;
  updated_on?: Date | string ;
  created_on: Date | string;
  commission?: number ;
  momoname?: string ;
  id: number;
};

export type PrimeLimsTableclinicianscredentials = {
  id: number;
  clinicianid: number;
  email: string;
  password: string;
  isAuthenticated: number;
  authenticationMode: string;
  authenticatedon: string;
  ispasswordUpdated?: number ;
  identifier: string;
};

export type PrimeLimsTableclinician_packages = {
  id: number;
  clinician_id: number;
  package_id: number;
  assigned_at: Date | string;
};

export type PrimeLimsTablecommodity = {
  comid: number;
  commodity: string;
  date: Date | string;
  category: string;
  suppliedby?: string ;
};

export type PrimeLimsTablecompanydaystimeschedule = {
  dayOne: string;
};

export type PrimeLimsTablecompanyprofile = {
  ID: number;
  NAME: string;
  EMAIL: string;
  MOTTO: string;
  PHONENUMBER: number;
  ADDRESS: string;
  ALTERNATIVENUMBER?: number ;
  WEBSITE?: string ;
  STREET: string;
  ALTERNativenumber?: number ;
};

export type PrimeLimsTablecomposedemails = {
  id: number;
  employeeid: number;
  subject: string;
  target: string;
  ispublished: string;
  created_on: Date | string;
  updated_on?: Date | string ;
  body: string;
  scheduledate?: Date | string ;
};

export type PrimeLimsTablecontrol_materials = {
  id: string;
  name: string;
  lotNumber: string;
  sourceType: string;
  manufacturer?: string ;
  sourceName?: string ;
  expiryDate: Date | string;
  openedDate?: Date | string ;
  storageConditions: string;
  status: string;
  notes?: string ;
  deviceId: string;
  createdby: number;
  updatedby: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  testId: number;
};

export type PrimeLimsTablecontrol_parameters = {
  id: string;
  controlMaterialId: string;
  parameter: string;
  value: number;
  unit: string;
  standardDeviation?: number ;
  warningLimit?: number ;
  actionLimit?: number ;
  validationNotes?: string ;
  createdby: number;
  updatedby: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PrimeLimsTablecustomtestcreation = {
  id: number;
  testid: number;
  creationrule?: string ;
  createdon: Date | string;
  updatedon?: Date | string ;
};

export type PrimeLimsTabledboexpensecategory = {
  id: number;
  category: string;
  createdon: Date | string;
  updatedon?: Date | string ;
  employeeid: number;
};

export type PrimeLimsTabledbosystemsecurity ={
  id: number;
  computerName: string;
  computerDrive: string;
  userDomain: string;
  systemRoot: string;
  createdon: Date | string;
  updatedOn: Date | string;
  appDir: string;
};

export type PrimeLimsTabledbobillingrefundtable = {
  refundid: number;
  serviceid: number;
  refundedBy: number;
  firstWitness: number;
  secondWitness: number;
  thirdWitness: number;
  firstWitnessPurpose?: string ;
  firstWitnessDate?: Date | string ;
  secondWitnessDate?: Date | string ;
  thirdWitnessDate?: Date | string ;
  isRefundCompleted: number;
  isRefundInitiated: number;
  initiatedBy?: number ;
  secondWitnessPurpose?: string ;
  thirdWitnessPurpose?: string ;
  isRefundApproved: number;
  approvalDate: number;
  approvedby?: number ;
  amountRefunded: number;
};

export type PrimeLimsTabledbogeneraltesteditcount = {
  id: number;
  ascensionid: number;
  billingid: number;
  counter: number;
  updatedon: Date | string;
  count: number;
};

export type PrimeLimsTabledboresult100102 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100103 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100105 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100121 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100122 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100123 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100124 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100125 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100126 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100127 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100128 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100129 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100133 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100134 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100135 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100136 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100137 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100138 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100139 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100140 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100141 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100142 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100143 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100144 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100145 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100146 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100147 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100148 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100149 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100150 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100151 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100152 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100153 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100154 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresult100155 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboresultauditlog100102 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100103 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100105 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100121 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100122 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100123 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100124 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100125 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100126 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100127 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100128 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100129 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100133 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100134 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100135 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100136 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100137 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100138 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100139 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100140 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100141 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100142 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100143 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100144 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100145 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100146 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100147 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100148 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100149 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100150 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100151 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100152 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100153 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100154 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlog100155 = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultauditlogundefined = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  previousValue?: string ;
  previousoriginalvalue?: string ;
  employeeid?: number ;
  fieldid?: number ;
  entrymode?: string ;
  created_on?: Date | string ;
};

export type PrimeLimsTabledboresultundefined = {
  id: number;
  field?: string ;
  billingid?: number ;
  patientid?: number ;
  value?: string ;
  originalvalue?: string ;
  created_on?: Date | string ;
  updatedon?: Date | string ;
  employeeid?: number ;
  entrymode?: string ;
};

export type PrimeLimsTabledboservices = {
  serviceid: number;
  billingid: number;
  trackId: number;
  cost: number;
  employeeid: number;
  serviceCategory?: string ;
  categoryTrackId: number;
  clinicianId?: number ;
  organizationId?: number ;
  registrationType?: string ;
  branchid: number;
  isoutsourced: number;
  outsourceid?: number ;
  serviceAddedOn: Date | string;
  taxList?: string ;
  taxValue: number;
  amountIncurredDueTax: number;
  taxIncluded: number;
  discount: number;
  totalcost: number;
  totalpayable: number;
  isNHIS: number;
  isPHIS: number;
  insuranceid?: string ;
  claimCode?: string ;
  hasNightAdjustment: number;
  nightAdjustmentValue: number;
  nightAdjustmentMode: string;
  isPackageUsed: number;
  packageid?: number ;
};

export type PrimeLimsTabledboservices_audit = {
  audit_id: number;
  serviceid?: number ;
  billingid?: number ;
  trackId?: number ;
  cost?: number ;
  employeeid?: number ;
  serviceCategory?: string ;
  categoryTrackId?: number ;
  clinicianId?: number ;
  organizationId?: number ;
  registrationType?: string ;
  branchid?: number ;
  isoutsourced?: number ;
  outsourceid?: number ;
  serviceAddedOn?: Date | string ;
  taxList?: string ;
  taxValue?: number ;
  amountIncurredDueTax?: number ;
  taxIncluded?: number ;
  discount?: number ;
  totalcost?: number ;
  totalpayable?: number ;
  isNHIS?: number ;
  isPHIS?: number ;
  insuranceid?: string ;
  claimCode?: string ;
  hasNightAdjustment?: number ;
  nightAdjustmentValue?: number ;
  nightAdjustmentMode?: string ;
  isPackageUsed?: number ;
  packageid?: number ;
  action_type?: string ;
  action_timestamp?: Date | string ;
  actor?: string ;
};

export type PrimeLimsTabledbotestresultapproval = {
  id: number;
  ascensionid: number;
  isapproved: number;
  approvedBy?: string ;
  printCount: number;
  lastupdatedon: Date | string;
};

export type PrimeLimsTabledbovitalsigns = {
  vitalsignid: number;
  patientid: number;
  bp: string;
  temperature: number;
  pulse: number;
  respiration: number;
  employeeid: number;
  date: Date | string;
  time: string;
  spo2: number;
  isConsulation?: number ;
  consultationid?: number ;
};

export type PrimeLimsTabledepartmentconsumptionhx = {
  comsumeid: number;
  department: number;
  stockid: number;
  batchnumber?: string ;
  brand?: string ;
  debit: number;
  date: Date | string;
  time: string;
  employeeid: number;
  wastage: number;
  productordersid: number;
};

export type PrimeLimsTabledepartmentmainstoresupplyproductorderlefttracking = {
  id: number;
  quantity: number;
  stockid: number;
  departmentid: number;
  batchnumber?: string ;
  createdOn: Date | string;
  brand?: string ;
  expiredDisposed: number;
  disposaldate?: Date | string ;
  employeeid?: number ;
  productordersid?: number ;
};

export type PrimeLimsTabledepartmentrequisition = {
  id: number;
  departmentid: number;
  stockid: number;
  quantity_requested: number;
  quantity_approved?: number ;
  comsumptionunit: string;
  status?: string ;
  date: Date | string;
  issue_message?: string ;
  departmentReceived?: number ;
  store_supplied?: number ;
  quantityReceived?: number ;
  requestingemployee: number;
  receivingemployee: number;
  approvedon?: Date | string ;
  approvedTime: string;
  requestapprovedby: number;
};

export type PrimeLimsTabledepartmentrequisitionhx = {
  id: number;
  stockid: number;
  brandid: number;
  batchnumber: string;
  status: string;
  qty: number;
  requisitionid: number;
  receivedon?: Date | string ;
  departmentid: number;
  productordersid: number;
  employeeid: number;
};

export type PrimeLimsTabledepartments = {
  id: number;
  department: string;
  departmentManager: string;
  date: Date | string;
  employeeid: number;
};

export type PrimeLimsTabledepartmentsmainsupply = {
  id: number;
  quantity: number;
  stockid: number;
  departmentid: number;
  batchnumber?: string ;
  createdOn: Date | string;
  brand?: string ;
  expiredDisposed: number;
  disposaldate?: Date | string ;
  employeeid?: number ;
  productordersid: number;
};

export type PrimeLimsTabledepartmentstocks = {
  id: number;
  deptid: number;
  stockid: number;
  quantityAvailable: number;
  date_added: Date | string;
  dateupdated?: Date | string ;
  comsumptionunit: string;
};

export type PrimeLimsTabledevices = {
  id: string;
  deviceName: string;
  model: string;
  serialNumber: string;
  manufacturer: string;
  installationDate: Date | string;
  lastCalibrationDate: Date | string;
  calibrationFrequency: number;
  createdby: number;
  location: string;
  status: string;
  notes?: string ;
  createdAt: Date | string;
  updatedAt: Date | string;
  updatedby: number;
};

export type PrimeLimsTabledistricts = {
  id: number;
  name: string;
  code: string;
  regionid?: number ;
};

export type PrimeLimsTabledrugs = {
  id: number;
  drug: string;
  category?: number ;
  createdby: number;
  addedOn?: Date | string ;
};

export type PrimeLimsTabledrugscategory = {
  id: number;
  categoryName: string;
  description?: string ;
  createdOn?: Date | string ;
  createdBy: string;
};

export type PrimeLimsTableemaillog = {
  id: number;
  target: number;
  type: string;
  success: number;
  date: Date | string;
  reason?: string ;
};

export type PrimeLimsTableemailpreference = {
  id: number;
  registration: string;
  result: string;
  rejection: string;
  approval: string;
  transactions: string;
  updated_on?: Date | string ;
  birthday: string;
  billing: string;
};

export type PrimeLimsTableemployeepreferredshifts = {
  employeeid: number;
  shiftid: number;
  preferenceid: number;
};

export type PrimeLimsTableemployeeunavailabledays = {
  employeeid: number;
  dayofweek: string;
  unavailableid: number;
};

export type PrimeLimsTableexpensesrecord = {
  id: number;
  name: string;
  date: Date | string;
  merchant: string;
  amount: number;
  category: number;
  mode: number;
  description: string;
  employeeid: number;
  branchid: number;
  createdon: Date | string;
  approved: number;
  approvedby: number;
  approvedon?: Date | string ;
  rejectionmessage?: string ;
};

export type PrimeLimsTablefield_constraints = {
  id: number;
  testid: number;
  fieldid: number;
  action: string;
  constraint_type: string;
  replacement_text?: string ;
  value?: string ;
  prefix?: string ;
  suffix?: string ;
};

export type PrimeLimsTablegeneralemailsettings = {
  id: number;
  provider: string;
  email: string;
  apppassword: string;
  verificationSubject: string;
  readySubject: string;
  sampleSubject: string;
  createdon: Date | string;
};

export type PrimeLimsTablegeneralledger = {
  id: number;
  transactionId: string;
  date: Date | string;
  description?: string ;
  accountId: number;
  subAccountId?: number ;
  type: string;
  amount: number;
  category: string;
};

export type PrimeLimsTablegeneralstocks = {
  stockid: number;
  name: string;
  category: number;
  consumptionunit: string;
  purchaseunit: string;
  quantity: number;
  alertlevel: number;
  materialcode: string;
  updatedOn?: Date | string ;
  date: Date | string;
  warehouse?: number ;
  shelf?: number ;
  minimum_qty: number;
  maximum_qty: number;
};

export type PrimeLimsTablegeneralstorecredithx = {
  id: number;
  productordersid: number;
  stockid: number;
  credit?: number ;
  brandid: number;
  batchnumber: string;
  creditDate: Date | string;
};

export type PrimeLimsTablegeneralstoredebithx = {
  id: number;
  stockid: number;
  brandid: number;
  debitdate: Date | string;
  batchnumber: string;
  productordersid?: number ;
  debitqty: number;
  departmentid: number;
  wastage: number;
};

export type PrimeLimsTableinventoryanalyticssummary = {
  id: number;
  settings?: string ;
};

export type PrimeLimsTableinventorycustomization = {
  id: number;
  settings: string;
  updated_on: Date | string;
};

export type PrimeLimsTablelimsautodeductionqueue = {
  id: number;
  quantity: number;
  branchid: number;
  departmentid: number;
  employeeid: number;
  ascensionid?: number ;
  billingid: number;
  resolved?: number ;
  created_at: Date | string;
};

export type PrimeLimsTablelimsintegrationinventorytemplate = {
  templateid: number;
  testid: number;
  template?: string ;
  createdon: Date | string;
  createdBy: number;
  lastupdated: Date | string;
  isDeductedAfterCompletion?: number ;
  isPhebotomy?: number ;
  isService?: number ;
  isTest?: number ;
};

export type PrimeLimsTableloggingcriticalvaluealert = {
  crkeyId: number;
  billingid: number;
  testid: number;
  constraint_type: string;
  statement: string;
  createdOn: Date | string;
  createdBy: number;
  isSeen?: number ;
  isSeenBy?: number ;
  ascensionid?: number ;
};

export type PrimeLimsTableloginlogs = {
  keyid: number;
  loginTime: Date | string;
  employeeid: number;
  loginSessionId: string;
  logoutTime: number;
  browserInformation: string;
  loggedout: number;
  actualLogout?: number ;
};

export type PrimeLimsTablemainstoresupply = {
  id: number;
  stockid: number;
  quantity?: number ;
  brandid?: number ;
  updated_on: Date | string;
  batchnumber: string;
};

export type PrimeLimsTablemainstoresupplyproductordertracking = {
  id: number;
  stockid: number;
  quantity?: number ;
  brandid?: number ;
  updated_on: Date | string;
  batchnumber: string;
  productordersid: number;
};

export type PrimeLimsTablemanager_sample_descision = {
  sampleid: number;
  billingid: number;
  action?: string ;
  message?: string ;
  manager?: string ;
  date: Date | string;
  testid: number;
};

export type PrimeLimsTablemedicalinterfacingdevices = {
  id: number;
  name?: string ;
  ip?: string ;
  dial_port?: string ;
  listen_port?: string ;
  connection_mode?: string ;
  use_tls?: number ;
  active?: number ;
  created_at: Date | string;
  testid?: number ;
  last_known_ip?: string ;
  last_connected?: Date | string ;
  device_info?: string ;
};

export type PrimeLimsTablemedicalrecords = {
  id: number;
  complaints: string;
  hpc: string;
  pmh: string;
  sh: string;
  odq: string;
  dhx: string;
  se: string;
  fh: string;
  obsGynecHistory: string;
  oe: string;
  record_type: string;
  created_at: Date | string;
  consulationby: number;
  patientid: number;
  associatedTransactionid?: number ;
};

export type PrimeLimsTablemedicalrecordsaudit = {
  auditid: number;
  complaints: string;
  hpc: string;
  pmh: string;
  sh: string;
  odq: string;
  dhx: string;
  se: string;
  fh: string;
  obsGynecHistory: string;
  oe: string;
  record_type: string;
  created_at: Date | string;
  consulationby: number;
};

export type PrimeLimsTablenew_patients = {
  id: number;
  firstname: string;
  email?: string ;
  dob?: Date | string ;
  age: number;
  gender?: string ;
  marital_status?: string ;
  mobile_number?: string ;
  agetype: string;
  occupation?: string ;
  date: Date | string;
  activation_status: string;
  lastname: string;
  middlename?: string ;
  organization?: string ;
  contactpointer: string;
  patientid?: number ;
  whatAppcontact?: string ;
  fullpatientid: string;
  designation?: string ;
};

export type PrimeLimsTableorderreceivedaccountsummary = {
  orderTransactionid?: number ;
  taxAmount?: number ;
  method: string;
  debit: number;
  credit: number;
  insertedOn: Date | string;
  updatedOn?: Date | string ;
  paymentmode: string;
  amountpaid: number;
};

export type PrimeLimsTableorders = {
  productordersid: number;
  stockid: number;
  orderTransactionid: number;
  name: string;
  supplierid: number;
  suppliername: string;
  purchaseunit: string;
  date: Date | string;
  quantity: number;
  received?: string ;
  quantityReceived?: number ;
  batchnumber?: string ;
  balance?: number ;
  expirydate?: Date | string ;
  receiveddate?: Date | string ;
  status?: string ;
  price?: number ;
  totalamount?: number ;
  productused?: string ;
  pricing: string;
  brand: number;
  expiredDisposed?: number ;
  disposaldate?: Date | string ;
  requestedby?: number ;
  receivedby?: number ;
  transactiondate: Date | string;
};

export type PrimeLimsTableorganization = {
  id: number;
  name?: string ;
  location?: string ;
  street?: string ;
  mobile?: number ;
  address?: string ;
  email?: string ;
  region?: string ;
  gpsmapping?: string ;
  website?: string ;
  type?: string ;
};

export type PrimeLimsTableorganizationaccountinformation = {
  id: number;
  organizationid: number;
  bankname?: string ;
  branch?: string ;
  accountname?: string ;
  account?: string ;
  module?: string ;
  momoname?: string ;
  momo?: number ;
  commission: number;
};

export type PrimeLimsTableorganizationalbillingtable = {
  id: number;
  organizationid?: number ;
  testpricing?: string ;
  useCustomLetterHeadings?: number ;
  concessionValue?: number ;
  concessionMode?: string ;
  haveDifferentPriceList?: number ;
  addedon?: Date | string ;
  updatedon?: Date | string ;
  hasConcessionAppliedAcross: number;
  createdby: number;
  organizationBillingType?: string ;
};

export type PrimeLimsTableorganizationcontactperson = {
  id: number;
  organizationid: number;
  name?: string ;
  email?: string ;
  mobile?: number ;
};

export type PrimeLimsTableorganization_packages = {
  id: number;
  organization_id: number;
  package_id: number;
  assigned_at: Date | string;
};

export type PrimeLimsTableoutsourcedtesttracking = {
  id: number;
  serviceid: number;
  testid: number;
  employeeid: number;
  status: number;
  comments: string;
  createdOn: Date | string;
  updatedOn?: Date | string ;
  outsourceid: number;
  completedconfirmedby?: number ;
};

export type PrimeLimsTableoutsourceorganizationcontract = {
  outsourceServiceId: number;
  startdate?: Date | string ;
  enddate?: Date | string ;
  outsourceid?: number ;
  billingTerms?: string ;
  discount?: number ;
  addedon?: Date | string ;
  updatedon?: Date | string ;
  createdby: number;
  updatedby?: number ;
};

export type PrimeLimsTableoutsourceorganizationservices = {
  outserviceid: number;
  outsourceid?: number ;
  generalTestId?: number ;
  outsourcePrice?: number ;
  addedon?: Date | string ;
  updatedon?: Date | string ;
  addedby: number;
  updatedby?: number ;
};

export type PrimeLimsTableoutsourcingorganization = {
  outsourceid: number;
  name?: string ;
  organizationType?: string ;
  email?: string ;
  address?: string ;
  billingAddress?: string ;
  contactNumber?: number ;
  contactPerson?: string ;
  addedon?: Date | string ;
  updatedon?: Date | string ;
  outsourceCreatedBy: number;
};

export type PrimeLimsTablepackages = {
  id: number;
  package_name: string;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: number;
};

export type PrimeLimsTablepackage_tests = {
  id: number;
  package_id: number;
  test_id: number;
  concession_mode: string;
  concession_value?: number ;
};

export type PrimeLimsTablepageaccess = {
  keyid: number;
  employeeid: number;
  registration: number;
  billing: number;
  inventory: number;
  supply: number;
  payments: number;
  approval: number;
  settings: number;
  phelobotomy: number;
};

export type PrimeLimsTablepatientemmergencycontactinformation = {
  keyid: number;
  patientid: number;
  emmergencyContactName?: string ;
  emmergencyContactNumber?: string ;
  relationship?: string ;
  occupation?: string ;
  address?: string ;
};

export type PrimeLimsTablepatientimages = {
  id: number;
  patientid: number;
  imagepath: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTablepatientsaddress = {
  keyid: number;
  patientid: number;
  area?: string ;
  region?: string ;
  gpsLocation?: string ;
  address?: string ;
  country?: string ;
  district?: string ;
};

export type PrimeLimsTablepatients_credentials = {
  id: number;
  patientid: number;
  username: string;
  password: string;
  updated: string;
  updated_on: Date | string;
};

export type PrimeLimsTablepatients_settings = {
  id: number;
  patientid: number;
  mode: string;
  method: string;
  notify?: number ;
  _read?: number ;
  read_on?: Date | string ;
  authenticated: number;
  authenticationMode?: string ;
  emailAuthenticated: string;
};

export type PrimeLimsTablepaymentmodes = {
  KeyID: number;
  PaymentMode: string;
};

export type PrimeLimsTableprivateinsurance = {
  id: number;
  insuranceName: string;
  insuranceCode: string;
  insuranceType?: string ;
  searchCode?: string ;
  network?: string ;
  tags?: string ;
  mailingAddress?: string ;
  city?: string ;
  state?: string ;
  county?: string ;
  zipCode?: string ;
  comments?: string ;
  isDisabled: number;
};

export type PrimeLimsTableproceduremanual = {
  id: number;
  testid: number;
  proceduremanual: string;
  createdon: Date | string;
  createdby: number;
  updatedon?: Date | string ;
  title: string;
};

export type PrimeLimsTableqc_readings = {
  id: string;
  sessionId: string;
  parameterId?: string ;
  parameter: string;
  value: string;
  status: string;
  createdAt: Date | string;
  createdby?: number ;
};

export type PrimeLimsTableqc_sessions = {
  id: string;
  controlMaterialId: string;
  comments?: string ;
  createdby: number;
  updatedby: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PrimeLimsTablerefundpaymenthx = {
  paymentid: number;
  refundableid: number;
  amountRefunded: number;
  employeeid: number;
  refundedon: Date | string;
};

export type PrimeLimsTableregions = {
  id: number;
  name: string;
  regioncode: string;
};

export type PrimeLimsTableregistrationsettings = {
  id: number;
  fields: string;
  createdon: Date | string;
  updatedon?: Date | string ;
  updatedby: number;
};

export type PrimeLimsTablerejectedsampledisputelog = {
  id: number;
  ascensionid: number;
  disputereason: string;
  disputedby: number;
  disputedon: Date | string;
};

export type PrimeLimsTableresultentrydrugsreaction = {
  keyid: number;
  drugid: number;
  reaction: string;
  lastupdatedon: Date | string;
  ascensionid: number;
  testid: number;
};

export type PrimeLimsTableresultsettings = {
  id: number;
  resultsettings: string;
  resultsEntrySettings?: string ;
};

export type PrimeLimsTableresult_comments = {
  keyid: number;
  testid: number;
  billingid: number;
  comments?: string ;
};

export type PrimeLimsTableresult_lock = {
  id: number;
  ascensionid: number;
  isResultLock?: number ;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTableroles = {
  employeeid: number;
  username: string;
  role: string;
  password: string;
  date_created?: Date | string ;
  TIME?: string ;
  refresh_token?: string ;
  activation: number;
  email: string;
  permissions: string;
  updated_on?: Date | string ;
  emailAuthenticated: string;
  branch?: number ;
  pin: number;
  time?: string ;
  mobile: string;
  alternativeMobile?: string ;
  dob?: Date | string ;
  imageurl?: string ;
};

export type PrimeLimsTablesales = {
  sales_employee: string;
  fiscal_year: number;
  sale: number;
  id: number;
};

export type PrimeLimsTablesalessessionmanager = {
  sessionid: number;
  sessiondate: Date | string;
  session_started_by?: number ;
  sessionendedon?: Date | string ;
  openingamount?: number ;
  amountreceivedby?: number ;
  branchid?: number ;
  validatedby?: number ;
  handingoveramount?: number ;
};

export type PrimeLimsTablesamplecontainer = {
  id: number;
  name: string;
  description?: string ;
  volume_capacity?: number ;
  material?: string ;
  color?: string ;
  is_reusable?: number ;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTablesamplestatus = {
  keyid: number;
  date: Date | string;
  rejectionmessage?: string ;
  testid: number;
  billingid: number;
  approvalstatus?: number ;
  sampleMessage?: string ;
  phelobotomist: number;
  ascensionid: number;
  redraw?: number ;
  redrawOrderDate?: Date | string ;
  samplevalidatedon?: Date | string ;
  validatedby?: number ;
  disputedby?: number ;
  disputedon?: Date | string ;
  disputereason?: string ;
  resolution?: string ;
  samplemessage?: string ;
  isRedraw: number;
};

export type PrimeLimsTablesampletype = {
  id: number;
  name: string;
  addedon: Date | string;
};

export type PrimeLimsTablesamplingtest = {
  TestKey: number;
  TestId: number;
  Billingid: number;
};

export type PrimeLimsTablescanreport = {
  id: number;
  patientid: number;
  billingid: number;
  testid: number;
  scan: string;
  created_on: Date | string;
  updated_on?: Date | string ;
  content: string;
  sonographer: string;
  employeeid?: number ;
};

export type PrimeLimsTableservicestracking = {
  id: number;
  serviceid: number;
  employeeid: number;
  status: number;
  comments: string;
  createdOn: Date | string;
  updatedOn?: Date | string ;
  isConsulation?: number ;
};

export type PrimeLimsTablesessiontracker = {
  id: number;
  loginSessionId: string;
  employeeid: number;
  logoutTime: number;
  loginhxid: number;
};

export type PrimeLimsTablesetupliteraturereview = {
  id: number;
  testid: number;
  literature?: string ;
  created_on: Date | string;
  updated_on?: Date | string ;
};

export type PrimeLimsTableshelves = {
  id: number;
  name: string;
  warehouse: number;
  created_on: Date | string;
};

export type PrimeLimsTableshifts = {
  id: number;
  name: string;
  color?: string ;
  starttime: string;
  endtime: string;
};

export type PrimeLimsTablesmsevents = {
  id: number;
  name: string;
  attachedscheduler: number;
  messageheader?: string ;
  activated: number;
};

export type PrimeLimsTablesmsmessages = {
  messageid: number;
  frequency: string;
  message: string;
  isTemplateused: number;
  templateid?: number ;
  isScheduled: number;
  scheduledDate?: Date | string ;
  scheduledTime?: string ;
  endDate: Date | string;
  usecase: string;
  isSent: number;
  templateCategory: string;
  isBulk: number;
  receipients?: string ;
};

export type PrimeLimsTablesmstemplate = {
  tempateid: number;
  templateName: string;
  placeholders?: string ;
  smscontent: string;
  createdby: number;
  createdon: Date | string;
};

export type PrimeLimsTablesms_logs = {
  id: number;
  sms_content: string;
  receiver_id: number;
  receiver_type: string;
  time_sent?: Date | string ;
  time_delivered?: Date | string ;
  is_event?: number ;
  event_name?: string ;
  year?: number ;
  messagestatus?: string ;
  sender_id?: number ;
  sender_type?: string ;
  retries?: number ;
  error_message?: string ;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTablestaffattendance = {
  id: number;
  employeeid: number;
  shiftid: number;
  date: Date | string;
  cycleid: number;
};

export type PrimeLimsTablesubscriptions = {
  id: number;
  device_id: number;
  start_date: Date | string;
  end_date: Date | string;
  is_active?: number ;
  license_key: string;
  max_devices?: number ;
  current_count?: number ;
  created_at: Date | string;
};

export type PrimeLimsTabletasks = {
  id: number;
  name: string;
  description?: string ;
  startDate: Date | string;
  endDate: Date | string;
  priority: string;
  frequency: string;
  assignedTo: string;
  completed?: number ;
};

export type PrimeLimsTabletax = {
  name: string;
  value: number;
  createdOn: Date | string;
  apply: string;
  id: number;
};

export type PrimeLimsTabletestconditiondefinitions = {
  id: number;
  conditionName: string;
  testId: number;
  createdOn: Date | string;
  updatedOn: Date | string;
};

export type PrimeLimsTabletestconditions = {
  id: number;
  testId: number;
  parameter: string;
  conditionId: number;
  target: string;
  inRange: number;
  createdBy?: string ;
  updatedOn: Date | string;
  conditionConstraint: string;
};

export type PrimeLimsTabletestcreationrules = {
  id: number;
  testid: number;
  name: string;
  field?: string ;
  value?: string ;
  hasunits?: number ;
  units?: string ;
  plan: string;
  plain?: string ;
  ordering?: number ;
  isValueTracked?: number ;
  textReference?: string ;
  upperlimit?: string ;
  lowerlimit?: string ;
  category?: string ;
  options?: string ;
  undercategory?: number ;
  categoryid?: number ;
  valueAlert?: string ;
  alert?: string ;
};

export type PrimeLimsTabletestdetailcategory = {
  categoryid: number;
  categoryname: string;
  testid: number;
  createdby: string;
  updatedby?: string ;
  created_at: Date | string;
  updated_at: Date | string;
  deleted?: number ;
};

export type PrimeLimsTabletestdetails = {
  id: number;
  testid?: number ;
  testcost?: number ;
  hasManual?: number ;
  procedureCode?: string ;
  pre_Tat?: number ;
  tat?: number ;
  post_Tat?: number ;
  tatCount?: number ;
  updatedon?: Date | string ;
  updatedby: number;
  isoutsourced: number;
  showtrend: number;
  testprice?: number ;
  hasGenderVariation: number;
  hasChildrenLimit: number;
  childrenlimit: string;
  useLiterature?: number ;
  hasDrugs: number;
  outSourcingList?: string ;
  post_TatEvaluation: string;
  pre_TatEvaluation: string;
  tatEvaluation: string;
};

export type PrimeLimsTabletestsynchronization = {
  synid: number;
  status: string;
  requestedon: Date | string;
  updatedon?: number ;
  targetTest: string;
  lastSyncdatetime?: Date | string ;
  requestedby: number;
};

export type PrimeLimsTabletest_ascension = {
  id: number;
  testid: number;
  billingid: number;
  collection?: string ;
  processing?: string ;
  ready?: string ;
  processing_date?: Date | string ;
  collection_date?: Date | string ;
  ready_date?: Date | string ;
  printcount?: number ;
  printedOn?: Date | string ;
  approvalStatus: number;
  Scientist?: number ;
  ApprovedBy?: number ;
  declineMessage?: string ;
  actionPlan?: string ;
  month: number;
  year: number;
  serviceid: number;
  ascension_date: Date | string;
  collectionStartDate?: Date | string ;
  collectionEndDate?: Date | string ;
  processingStartDate?: Date | string ;
  processingEndDate?: Date | string ;
  resultEntryStart?: Date | string ;
  resultEntryEnd?: Date | string ;
  sampleCollectedBy: number;
  sampleProcessedBy?: number ;
  resultEnteredBy?: number ;
};

export type PrimeLimsTabletest_billing = {
  billingid: number;
  patientid: number;
  totalTransactionCost?: number ;
  totalcost: number;
  paid: number;
  payable: number;
  totalrefunded: number;
  discount: number;
  outstanding: number;
  balance: number;
  billedon: Date | string;
  clientstatus: string;
  branchid: number;
  year: number;
  month: number;
  day?: number ;
  amountIncurredDueTax: number;
  lastupdated: Date | string;
};

export type PrimeLimsTabletest_billinghx = {
  KeyID: number;
  Billingid: number;
  Date: Date | string;
  PaymentMode: number;
  Amount: number;
  employeeid: number;
  type: string;
  description?: string ;
  isRefund: number;
  refundId?: number ;
};

export type PrimeLimsTabletest_categories = {
  ID: number;
  CATEGORY: string;
  DESCRIPTION: string;
};

export type PrimeLimsTabletest_dbobillingrefundtable = {
  refundid: number;
  serviceid: number;
  refundedBy: number;
  firstWitness: number;
  secondWitness: number;
  thirdWitness: number;
  firstWitnessPurpose?: string ;
  firstWitnessDate?: Date | string ;
  secondWitnessDate?: Date | string ;
  thirdWitnessDate?: Date | string ;
  isRefundCompleted: number;
  isRefundInitiated: number;
  initiatedBy?: number ;
  secondWitnessPurpose?: string ;
  thirdWitnessPurpose?: string ;
  isRefundApproved: number;
  approvalDate: number;
  approvedby?: number ;
  amountRefunded: number;
};

export type PrimeLimsTabletest_dboservices = {
  serviceid: number;
  billingid: number;
  trackId: number;
  cost: number;
  employeeid: number;
  serviceCategory?: string ;
  categoryTrackId: number;
  clinicianId?: number ;
  organizationId?: number ;
  registrationType?: string ;
  branchid: number;
  isoutsourced: number;
  outsourceid?: number ;
  serviceAddedOn: Date | string;
  taxList?: string ;
  taxValue: number;
  amountIncurredDueTax: number;
  taxIncluded: number;
  discount: number;
  totalcost: number;
  totalpayable: number;
  isNHIS: number;
  isPHIS: number;
  insuranceid?: string ;
  claimCode?: string ;
  hasNightAdjustment: number;
  nightAdjustmentValue: number;
  nightAdjustmentMode: string;
  isPackageUsed: number;
  packageid?: number ;
};

export type PrimeLimsTabletest_panels = {
  prim_key: number;
  name: string;
  category: number;
  price: number;
  created_on: Date | string;
  sample: number;
  description?: string ;
  sample_container: string;
  unit: string;
  qty_required?: string ;
  shorttext?: string ;
  iscustom: number;
  id: number;
};

export type PrimeLimsTabletest_refundpaymenthx = {
  paymentid: number;
  refundableid: number;
  amountRefunded: number;
  employeeid: number;
  refundedon: Date | string;
};

export type PrimeLimsTabletest_results = {
  id: number;
  field: string;
  ascensionid: number;
  billingid: number;
  patientid: number;
  testid: number;
  value?: string ;
  originalvalue?: string ;
  created_on: Date | string;
  updated_on?: Date | string ;
  employeeid: number;
  entrymode?: string ;
  fieldid: number;
};

export type PrimeLimsTabletest_results_audit_log = {
  id: number;
  field: string;
  ascensionid: number;
  billingid: number;
  patientid: number;
  testid: number;
  previous_value?: string ;
  previous_originalvalue?: string ;
  employeeid: number;
  fieldid: number;
  entrymode?: string ;
  created_on: Date | string;
  action_type: string;
};

export type PrimeLimsTabletest_results_ultrasound = {
  id: number;
  field: string;
  ascensionid: number;
  billingid: number;
  patientid: number;
  testid: number;
  value?: string ;
  originalvalue?: string ;
  created_on: Date | string;
  updated_on?: Date | string ;
  employeeid: number;
  entrymode?: string ;
  fieldid: number;
};

export type PrimeLimsTableultrasoundtemplates = {
  keyid: number;
  templateid: number;
  field: string;
  value: string;
  lastupdatedon: Date | string;
};

export type PrimeLimsTableultrasoundtemplatesmapper = {
  keyid: number;
  testid: number;
  name: string;
  associatedbodypart?: string ;
  createdOn: Date | string;
  createdby: number;
  visibletoAll: number;
};

export type PrimeLimsTableview_billing_summary = {
  billingid: number;
  patientid: number;
  billedon: Date | string;
  totalcost: number;
  discount: number;
  paid: number;
  payable: number;
  outstanding: number;
  services_rendered: number;
};

export type PrimeLimsTablewarehouse = {
  id: number;
  name: string;
  created_on: Date | string;
  updated_on?: Date | string ;
};

export type PrimeLimsTablewastagecount = {
  id: number;
  amount: number;
  wastedCount: number;
  updated_on: Date | string;
};

export type PrimeLimsTablewastagehx = {
  id: number;
  stockid: number;
  brandid: number;
  removedOn: Date | string;
  qty: number;
  price: number;
  departmentid: number;
  batchnumber: string;
  level: string;
};

export type PrimeLimsTableweekly_sales_summary = {
  week: number;
  startDate: Date | string;
  endDate: Date | string;
  serviceCount: number;
  totalSales: number;
  salesPercentage: number;
};

