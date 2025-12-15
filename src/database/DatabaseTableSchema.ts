// Generated types for database tables

export type PrimeLimsTableaccounts = {
  id: number;
  accountId: string;
  accountName: string;
  type: string;
  isImmutable?: number;
  normalBalance: string;
  USER?: string;
  HOST?: string;
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
  patientIdPrefix?: string;
  fontFamily?: string;
  billingidPrefix?: string;
  services?: string;
  billingsettings?: string;
  regioncode: number;
  districtcode: number;
};

export type PrimeLimsTableappointments = {
  refid: number;
  patientid: number;
  duration: number;
  status?: string;
  appointment_time: string;
  appointment_date: Date | string;
  inviteMethod: string;
  purpose: string;
  title: string;
  preference: string;
  practioner: number;
  location: string;
  notes?: string;
};

export type PrimeLimsTableattendancecycles = {
  id: number;
  cyclestart: Date | string;
  cycleend: Date | string;
  description?: string;
};


export type BillingStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'corrected'
  | 'voided'
  | 'adjustment'
  | 'written-off';

export type PromoMethod =
  | 'percentage'
  | 'flat';

export type AdjustmentType =
  | 'addition'
  | 'correction'
  | 'void'
  | 'written-off'
  | 'referer-error';




export type PrimeLimsTablebilling = {
  billingid: number;
  patientid: number;

  totalTransactionCost: number;
  totalcost: number;
  paid: number;
  payable: number;
  totalrefunded: number;
  discount: number;
  outstanding: number;
  balance: number;

  billedon: Date;

  clientstatus: string;

  year: number;
  month: number;
  day: number | null;

  amountIncurredDueTax: number;

  lastupdated: Date;

  branchid: number;

  isPromo: boolean;
  promoValue: number;
  promoMethod: PromoMethod | null;
  promoCodeId: number | null;

  status: BillingStatus;

  relatedBillingId: number | null;

  isAdjustment: boolean;
  adjustedBy: number | null;
  adjustmentReason: string | null;
  adjustmentType: AdjustmentType | null;
  adjustmentdate: Date | null;
  adjustmentamount: number | null;

  islocked: boolean;

  additionalinformation: string | null;
  writeoff: number | null;
}

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
  name: string;
  description?: string;
  concessionMode?: string;
  concessionValue?: number;
  price_type?: string;
  allconcessionApplied: number;
  valid_from?: Date | string;
  valid_until?: Date | string;
  is_expired: number;
  createdon: Date | string;
  updatedon?: Date | string;
  associatedid: number;
  applicableOrganization?: string;
  applicableTest?: string;
  isInsurance: number;
  isClinician: number;
  category: string;
};

export type PrimeLimsTablebillingstrategy_mapping = {
  strategyid: number;
  entity_type: string;
  entity_id: number;
};

export type PrimeLimsTablebillingstrategy_tests = {
  strategyid: number;
  testid: number;
  concessionValue: number;
  discountedValue: number;
  concessionMode: string;
  pricingType: string;
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
  billingid?: number;
  patientid?: number;
  totalTransactionCost?: number;
  totalcost?: number;
  paid?: number;
  payable?: number;
  totalrefunded?: number;
  discount?: number;
  outstanding?: number;
  balance?: number;
  billedon?: Date | string;
  clientstatus?: string;
  year?: number;
  month?: number;
  day?: number;
  amountIncurredDueTax?: number;
  lastupdated: Date | string;
  action_type?: string;
  action_timestamp?: Date | string;
  actor?: string;
};

export type PrimeLimsTablebranch = {
  branchid: number;
  name: string;
  date: Date | string;
  activation: number;
  address?: string;
  email?: string;
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
  updated_on?: Date | string;
  created_on: Date | string;
  phone: number;
  identifier: string;
};

export type PrimeLimsTableclinicianpaymentinfo = {
  ID: number;
  clinicianid: number;
  module: string;
  momo?: number;
  bankname?: string;
  bankbranch?: string;
  accountnumber?: number;
  accountname?: string;
  organization: number;
  updated_on?: Date | string;
  created_on: Date | string;
  commission?: number;
  momoname?: string;
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
  ispasswordUpdated?: number;
  identifier: string;
};

export type PrimeLimsTableclinician_daily_sales_summary = {
  sale_date?: Date | string;
  clinician_id: number;
  clinician_name: string;
  clinician_phone: string;
  occupation?: string;
  organization?: number;
  total_services: number;
  total_value?: number;
  additional_services_count?: number;
  test_panels_count?: number;
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
  suppliedby?: string;
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
  ALTERNATIVENUMBER?: number;
  WEBSITE?: string;
  STREET: string;
  ALTERNativenumber?: number;
};

export type PrimeLimsTablecomposedemails = {
  id: number;
  employeeid: number;
  subject: string;
  target: string;
  ispublished: string;
  created_on: Date | string;
  updated_on?: Date | string;
  body: string;
  scheduledate?: Date | string;
};

export type PrimeLimsTablecontrol_materials = {
  id: string;
  name: string;
  lotNumber: string;
  sourceType: string;
  manufacturer?: string;
  sourceName?: string;
  expiryDate: Date | string;
  openedDate?: Date | string;
  storageConditions: string;
  status: string;
  notes?: string;
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
  standardDeviation?: number;
  warningLimit?: number;
  actionLimit?: number;
  validationNotes?: string;
  createdby: number;
  updatedby: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PrimeLimsTablecustomtestcreation = {
  id: number;
  testid: number;
  creationrule?: string;
  createdon: Date | string;
  updatedon?: Date | string;
};

export type PrimeLimsTabledaily_adjustments_impact = {
  report_date?: Date | string;
  total_billed_without_night_adjustment?: number;
  amount_gained_from_night_adjustment?: number;
  total_billed_with_night_adjustment?: number;
  billed_without_night_adjustment_part_for_night_adjusted_services?: number;
  night_adjustment_uplift?: number;
  package_cases?: number;
  package_total_value?: number;
  total_cases: number;
  clinician_referrals?: number;
  organization_referrals?: number;
  self_cases?: number;
};

export type PrimeLimsTabledaily_analytics_snapshot = {
  analytics_date?: Date | string;
  total_billing_amount?: number;
  total_payable_amount?: number;
  total_paid_amount?: number;
  total_services_rendered: number;
  total_refunds_processed?: number;
  total_refund_payments_made?: number;
  total_outstanding_amount?: number;
  total_discounts_given?: number;
  total_tax_incurred?: number;
  unique_patients_billed: number;
  refund_completion_rate_percentage?: number;
};

export type PrimeLimsTabledaily_test_transaction_snap_shot = {
  serviceAddedOn: Date | string;
  test_date?: Date | string;
  trackId: number;
  serviceCategory?: string;
  test_panel_name?: string;
  test_count: number;
  total_amount?: number;
};

export type PrimeLimsTabledbosystemsecurity = {
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
  firstWitnessPurpose?: string;
  firstWitnessDate?: Date | string;
  secondWitnessDate?: Date | string;
  thirdWitnessDate?: Date | string;
  isRefundCompleted: number;
  isRefundInitiated: number;
  initiatedBy?: number;
  secondWitnessPurpose?: string;
  thirdWitnessPurpose?: string;
  isRefundApproved: number;
  approvalDate: number;
  approvedby?: number;
  amountRefunded: number;
};

export type PrimeLimsTabledboexpensecategory = {
  id: number;
  category: string;
  createdon: Date | string;
  updatedon?: Date | string;
  employeeid: number;
};

export type PrimeLimsTabledbogeneraltesteditcount = {
  id: number;
  ascensionid: number;
  billingid: number;
  counter: number;
  updatedon: Date | string;
  count: number;
};

export type PrimeLimsTabledboservices = {
  serviceid: number;
  billingid: number;
  trackId: number;
  cost: number;
  employeeid: number;
  serviceCategory?: string;
  categoryTrackId: number;
  clinicianId?: number;
  organizationId?: number;
  registrationType?: string;
  branchid: number;
  isoutsourced: number;
  paidstatus: string;
  paidamount: number;
  outsourceprice: number;
  paymentstatus: "paid" | "pending" | "partial";
  outsourceid?: number;
  serviceAddedOn: Date | string;
  outstanding: number;
  taxList?: string;
  taxValue: number;
  amountIncurredDueTax: number;
  taxIncluded: number;
  discount: number;
  totalcost: number;
  totalpayable: number;
  isNHIS: number;
  isPHIS: number;
  insuranceid?: string;
  claimCode?: string;
  hasNightAdjustment: number;
  nightAdjustmentValue: number;
  nightAdjustmentMode: string;
  isPackageUsed: number;
  packageid?: number;
  status: string;
  isRefunded: number;
  isLocked: number;
};

export type PrimeLimsTabledboservices_audit = {
  audit_id: number;
  serviceid?: number;
  billingid?: number;
  trackId?: number;
  cost?: number;
  employeeid?: number;
  serviceCategory?: string;
  categoryTrackId?: number;
  clinicianId?: number;
  organizationId?: number;
  registrationType?: string;
  branchid?: number;
  isoutsourced?: number;
  outsourceid?: number;
  serviceAddedOn?: Date | string;
  taxList?: string;
  taxValue?: number;
  amountIncurredDueTax?: number;
  taxIncluded?: number;
  discount?: number;
  totalcost?: number;
  totalpayable?: number;
  isNHIS?: number;
  isPHIS?: number;
  insuranceid?: string;
  claimCode?: string;
  hasNightAdjustment?: number;
  nightAdjustmentValue?: number;
  nightAdjustmentMode?: string;
  isPackageUsed?: number;
  packageid?: number;
  action_type?: string;
  action_timestamp?: Date | string;
  actor?: string;
};

export type PrimeLimsTabledbotestresultapproval = {
  id: number;
  ascensionid: number;
  isapproved: number;
  approvedBy?: string;
  printCount: number;
  lastupdatedon: Date | string;
  maxvalidation?: number;
  minvalidation?: number;
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
  isConsulation?: number;
  consultationid?: number;
};

export type PrimeLimsTabledepartmentconsumptionhx = {
  comsumeid: number;
  department: number;
  stockid: number;
  batchnumber?: string;
  brand?: string;
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
  batchnumber?: string;
  createdOn: Date | string;
  brand?: string;
  expiredDisposed: number;
  disposaldate?: Date | string;
  employeeid?: number;
  productordersid?: number;
};

export type PrimeLimsTabledepartmentrequisition = {
  id: number;
  departmentid: number;
  stockid: number;
  quantity_requested: number;
  quantity_approved?: number;
  comsumptionunit: string;
  status?: string;
  date: Date | string;
  issue_message?: string;
  departmentReceived?: number;
  store_supplied?: number;
  quantityReceived?: number;
  requestingemployee: number;
  receivingemployee: number;
  approvedon?: Date | string;
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
  receivedon?: Date | string;
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
  name: string;
  description?: string;
  head_employee_id?: number;
  budget?: number;
  is_active?: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTabledepartmentsmainsupply = {
  id: number;
  quantity: number;
  stockid: number;
  departmentid: number;
  batchnumber?: string;
  createdOn: Date | string;
  brand?: string;
  expiredDisposed: number;
  disposaldate?: Date | string;
  employeeid?: number;
  productordersid: number;
};

export type PrimeLimsTabledepartmentstocks = {
  id: number;
  deptid: number;
  stockid: number;
  quantityAvailable: number;
  date_added: Date | string;
  dateupdated?: Date | string;
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
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  updatedby: number;
};

export type PrimeLimsTabledistricts = {
  id: number;
  name: string;
  code: string;
  regionid?: number;
};

export type PrimeLimsTabledrugs = {
  id: number;
  drug: string;
  category?: number;
  createdby: number;
  addedOn?: Date | string;
};

export type PrimeLimsTabledrugscategory = {
  id: number;
  categoryName: string;
  description?: string;
  createdOn?: Date | string;
  createdBy: string;
};

export type PrimeLimsTableemaillog = {
  id: number;
  target: number;
  type: string;
  success: number;
  date: Date | string;
  reason?: string;
};

export type PrimeLimsTableemailpreference = {
  id: number;
  registration: string;
  result: string;
  rejection: string;
  approval: string;
  transactions: string;
  updated_on?: Date | string;
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

export type PrimeLimsTableevent_template_map = {
  event_id: number;
  template_id: number;
};

export type PrimeLimsTableexpensesrecord = {
  id: number;
  name: string;
  date: Date | string;
  merchant: number;
  amount: number;
  category: number;
  description: string;
  employeeid: number;
  branchid: number;
  createdon: Date | string;
  approved: number;
  approvedby: number;
  approvedon?: Date | string;
  rejectionmessage?: string;
  isassociatedservice?: number;
  serviceid?: number;
  groupId?: string;
};

export type PrimeLimsTableexpensesrecord_audit_log = {
  audit_id: number;
  uid: string;
  operation: string;
  table_name: string;
  record_id: number;
  old_data?: string;
  new_data?: string;
  changed_by?: number;
  changed_on?: Date | string;
  client_ip?: string;
};

export type PrimeLimsTablefield_constraints = {
  id: number;
  testid: number;
  fieldid: number;
  action: string;
  constraint_type: string;
  replacement_text?: string;
  value?: string;
  prefix?: string;
  suffix?: string;
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
  description?: string;
  accountId: number;
  subAccountId?: number;
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
  updatedOn?: Date | string;
  date: Date | string;
  warehouse?: number;
  shelf?: number;
  minimum_qty: number;
  maximum_qty: number;
};

export type PrimeLimsTablegeneralstorecredithx = {
  id: number;
  productordersid: number;
  stockid: number;
  credit?: number;
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
  productordersid?: number;
  debitqty: number;
  departmentid: number;
  wastage: number;
};

export type PrimeLimsTablehr_auditlogs = {
  auditid: number;
  employeeid: number;
  action?: string;
  timestamp?: Date | string;
  digitalsignature?: string;
};

export type PrimeLimsTablehr_employeelogincredentials = {
  credentialid: number;
  employeeid: number;
  password: string;
  pin?: number;
  authenticationmethod?: string;
  accountstatus?: string;
  activation: number;
  refreshtoken?: string;
  lastlogin?: Date | string;
  emailauthenticated?: number;
  datecreated?: Date | string;
  timecreated?: string;
  updatedon?: Date | string;
};

export type PrimeLimsTablehr_employeemergencycontacts = {
  contactid: number;
  employeeid: number;
  contactname: string;
  relationship?: string;
  contactphone?: string;
  contactemail?: string;
};

export type PrimeLimsTablehr_performancemetrics = {
  metricid: number;
  employeeid: number;
  samplesprocessed?: number;
  errorsreported?: number;
  qaoutcomes?: string;
  reportdate?: Date | string;
};

export type PrimeLimsTablehr_rolespermissions = {
  roleid: number;
  employeeid: number;
  rolename: string;
  permissions?: string;
  accessrights?: string;
};

export type PrimeLimsTablehr_trainingrecords = {
  trainingid: number;
  employeeid: number;
  trainingname?: string;
  completiondate?: Date | string;
  refresherduedate?: Date | string;
  competencyscore?: number;
  certificationfileurl?: string;
};

export type PrimeLimsTablehr_workflowassignments = {
  assignmentid: number;
  employeeid: number;
  workflowname?: string;
  instrumentname?: string;
  projectname?: string;
};

export type PrimeLimsTableinventoryanalyticssummary = {
  id: number;
  settings?: string;
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
  ascensionid?: number;
  billingid: number;
  resolved?: number;
  created_at: Date | string;
};

export type PrimeLimsTablelimsintegrationinventorytemplate = {
  templateid: number;
  testid: number;
  template?: string;
  createdon: Date | string;
  createdBy: number;
  lastupdated: Date | string;
  isDeductedAfterCompletion?: number;
  isPhebotomy?: number;
  isService?: number;
  isTest?: number;
};

export type PrimeLimsTableloggingcriticalvaluealert = {
  crkeyId: number;
  billingid: number;
  testid: number;
  constraint_type: string;
  statement: string;
  createdOn: Date | string;
  createdBy: number;
  isSeen?: number;
  isSeenBy?: number;
  ascensionid?: number;
};

export type PrimeLimsTableloginlogs = {
  keyid: number;
  loginTime: Date | string;
  employeeid: number;
  loginSessionId: string;
  logoutTime: number;
  browserInformation: string;
  loggedout: number;
  actualLogout?: number;
};

export type PrimeLimsTablemainstoresupply = {
  id: number;
  stockid: number;
  quantity?: number;
  brandid?: number;
  updated_on: Date | string;
  batchnumber: string;
};

export type PrimeLimsTablemainstoresupplyproductordertracking = {
  id: number;
  stockid: number;
  quantity?: number;
  brandid?: number;
  updated_on: Date | string;
  batchnumber: string;
  productordersid: number;
};

export type PrimeLimsTablemanager_sample_descision = {
  sampleid: number;
  billingid: number;
  action?: string;
  message?: string;
  manager?: string;
  date: Date | string;
  testid: number;
};

export type PrimeLimsTablemedicalinterfacingdevices = {
  id: number;
  name?: string;
  ip?: string;
  dial_port?: string;
  listen_port?: string;
  connection_mode?: string;
  use_tls?: number;
  active?: number;
  created_at: Date | string;
  testid?: number;
  last_known_ip?: string;
  last_connected?: Date | string;
  device_info?: string;
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
  associatedTransactionid?: number;
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
  email?: string;
  dob?: Date | string;
  age: number;
  gender?: string;
  marital_status?: string;
  mobile_number?: string;
  agetype: string;
  occupation?: string;
  date: Date | string;
  activation_status: string;
  lastname: string;
  middlename?: string;
  organization?: string;
  contactpointer: string;
  patientid?: number;
  whatAppcontact?: string;
  fullpatientid: string;
  designation?: string;
};

export type PrimeLimsTableorderreceivedaccountsummary = {
  orderTransactionid?: number;
  taxAmount?: number;
  method: string;
  debit: number;
  credit: number;
  insertedOn: Date | string;
  updatedOn?: Date | string;
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
  received?: string;
  quantityReceived?: number;
  batchnumber?: string;
  balance?: number;
  expirydate?: Date | string;
  receiveddate?: Date | string;
  status?: string;
  price?: number;
  totalamount?: number;
  productused?: string;
  pricing: string;
  brand: number;
  expiredDisposed?: number;
  disposaldate?: Date | string;
  requestedby?: number;
  receivedby?: number;
  transactiondate: Date | string;
};

export type PrimeLimsTableorganization = {
  id: number;
  name?: string;
  location?: string;
  street?: string;
  mobile?: number;
  address?: string;
  email?: string;
  region?: string;
  gpsmapping?: string;
  website?: string;
  type?: string;
};

export type PrimeLimsTableorganizationaccountinformation = {
  id: number;
  organizationid: number;
  bankname?: string;
  branch?: string;
  accountname?: string;
  account?: string;
  module?: string;
  momoname?: string;
  momo?: number;
  commission: number;
};

export type PrimeLimsTableorganizationalbillingtable = {
  id: number;
  organizationid?: number;
  testpricing?: string;
  useCustomLetterHeadings?: number;
  concessionValue?: number;
  concessionMode?: string;
  haveDifferentPriceList?: number;
  addedon?: Date | string;
  updatedon?: Date | string;
  hasConcessionAppliedAcross: number;
  createdby: number;
  organizationBillingType?: string;
};

export type PrimeLimsTableorganizationcontactperson = {
  id: number;
  organizationid: number;
  name?: string;
  email?: string;
  mobile?: number;
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
  updatedOn?: Date | string;
  outsourceid: number;
  completedconfirmedby?: number;
};

export type PrimeLimsTableoutsourceorganizationcontract = {
  outsourceServiceId: number;
  startdate?: Date | string;
  enddate?: Date | string;
  outsourceid?: number;
  billingTerms?: string;
  discount?: number;
  addedon?: Date | string;
  updatedon?: Date | string;
  createdby: number;
  updatedby?: number;
};

export type PrimeLimsTableoutsourceorganizationservices = {
  outserviceid: number;
  outsourceid?: number;
  generalTestId?: number;
  outsourcePrice?: number;
  addedon?: Date | string;
  updatedon?: Date | string;
  addedby: number;
  updatedby?: number;
};

export type PrimeLimsTableoutsourcingorganization = {
  outsourceid: number;
  name?: string;
  organizationType?: string;
  email?: string;
  address?: string;
  billingAddress?: string;
  contactNumber?: number;
  contactPerson?: string;
  addedon?: Date | string;
  updatedon?: Date | string;
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
  concession_value?: number;
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
  emmergencyContactName?: string;
  emmergencyContactNumber?: string;
  relationship?: string;
  occupation?: string;
  address?: string;
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
  area?: string;
  region?: string;
  gpsLocation?: string;
  address?: string;
  country?: string;
  district?: string;
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
  notify?: number;
  _read?: number;
  read_on?: Date | string;
  authenticated: number;
  authenticationMode?: string;
  emailAuthenticated: string;
};

export type PrimeLimsTablepatient_clinical_history_ultrasound = {
  id: number;
  ascensionid: number;
  clinical_history?: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTablepaymentmodes = {
  KeyID: number;
  PaymentMode: string;
};

export type PrimeLimsTableprimesmscategorymappings = {
  id: number;
  category: string;
  tablename: string;
  idcolumn: string;
  phonecolumn?: string;
  namecolumn?: string;
  additionalfields?: string;
};

export type PrimeLimsTableprimesmsevents = {
  eventid: number;
  code: string;
  description?: string;
  category: string;
  createdat: Date | string;
  content?: string;
  active: number;
  placeholders?: string;
};

export type PrimeLimsTableprimesmseventtemplates = {
  id: number;
  eventid: number;
  templateid: number;
  isactive?: number;
};

export type PrimeLimsTableprimesmsjobrecipients = {
  recid: number;
  jobid: number;
  phonee164: string;
  personalizedbody: string;
  deliverystatus?: string;
  sentat?: Date | string;
  errorcode?: string;
  refid: number;
  messageid?: string;
};

export type PrimeLimsTableprimesmsjobs = {
  jobid: number;
  templateid?: number;
  custombody?: string;
  category: string;
  recipientscope: string;
  targetids?: string;
  sendtype: string;
  scheduledat?: Date | string;
  status?: string;
  createdby: number;
  createdat: Date | string;
};

export type PrimeLimsTableprimesmsplaceholderrules = {
  id: number;
  category: string;
  placeholder: string;
  columnname: string;
  tablename: string;
  description?: string;
};

export type PrimeLimsTableprimesmstemplates = {
  templateid: number;
  name: string;
  body: string;
  category: string;
  createdby: number;
  createdat: Date | string;
};

export type PrimeLimsTableprime_active_billing_strategy_assignments = {
  id: number;
  billing_strategy_id: number;
  entity_type: string;
  track_id?: number;
  applies_from: Date | string;
  applies_to?: Date | string;
};

export type PrimeLimsTableprime_billing_audit = {
  id: number;
  entity_type: string;
  track_id?: number;
  test_panel_id: number;
  base_price: number;
  final_price: number;
  strategy_id?: number;
  price_id?: number;
  promo_code_id?: number;
  conditions_applied?: string;
  calculated_at: Date | string;
};

export type PrimeLimsTableprime_billing_campaigns = {
  id: number;
  name: string;
  description?: string;
  start_date: Date | string;
  end_date?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTableprime_billing_promo_codes = {
  id: number;
  code: string;
  description?: string;
  campaign_id?: number;
  discount_type: string;
  discount_value: number;
  max_uses?: number;
  times_used?: number;
  is_active?: number;
  valid_from: Date | string;
  valid_to?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTableprime_billing_strategies = {
  id: number;
  name: string;
  description?: string;
  is_discount?: number;
  applies_to_all_tests?: number;
  priority?: number;
  apply_time_based?: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTableprime_billing_strategy_assignments = {
  id: number;
  billing_strategy_id: number;
  entity_type: string;
  track_id?: number;
  applies_from: Date | string;
  applies_to?: Date | string;
};

export type PrimeLimsTableprime_billing_strategy_conditions = {
  id: number;
  billing_strategy_id: number;
  condition_type: string;
  condition_value?: string;
  comparator?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
};

export type PrimeLimsTableprime_billing_strategy_prices = {
  id: number;
  billing_strategy_id: number;
  test_panel_id?: number;
  price_type: string;
  amount: number;
};

export type PrimeLimsTableprivateinsurance = {
  id: number;
  insuranceName: string;
  insuranceCode: string;
  insuranceType?: string;
  searchCode?: string;
  network?: string;
  tags?: string;
  mailingAddress?: string;
  city?: string;
  state?: string;
  county?: string;
  zipCode?: string;
  comments?: string;
  isDisabled: number;
};

export type PrimeLimsTableproceduremanual = {
  id: number;
  testid: number;
  proceduremanual: string;
  createdon: Date | string;
  createdby: number;
  updatedon?: Date | string;
  title: string;
};

export type PrimeLimsTableqc_readings = {
  id: string;
  sessionId: string;
  parameterId?: string;
  parameter: string;
  value: string;
  status: string;
  createdAt: Date | string;
  createdby?: number;
};

export type PrimeLimsTableqc_sessions = {
  id: string;
  controlMaterialId: string;
  comments?: string;
  createdby: number;
  updatedby: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PrimeLimsTablereferralcoding = {
  id: number;
  entity_id: number;
  entity_type: string;
  code: number;
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
  updatedon?: Date | string;
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
  resultsEntrySettings?: string;
};

export type PrimeLimsTableresult_comments = {
  keyid: number;
  testid: number;
  billingid: number;
  comments?: string;
};

export type PrimeLimsTableresult_lock = {
  id: number;
  ascensionid: number;
  isResultLock?: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTableroles = {
  employeeid: number;
  username: string;
  role: string;
  password: string;
  date_created?: Date | string;
  TIME?: string;
  refresh_token?: string;
  activation: number;
  email: string;
  permissions: string;
  updated_on?: Date | string;
  emailAuthenticated: string;
  branch?: number;
  pin?: number;
  time?: string;
  mobile: string;
  alternativeMobile?: string;
  dob?: Date | string;
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
  session_started_by?: number;
  sessionendedon?: Date | string;
  openingamount?: number;
  amountreceivedby?: number;
  branchid?: number;
  validatedby?: number;
  handingoveramount?: number;
};

export type PrimeLimsTablesamplecontainer = {
  id: number;
  name: string;
  description?: string;
  volume_capacity?: number;
  material?: string;
  color?: string;
  is_reusable?: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTablesamplestatus = {
  keyid: number;
  date: Date | string;
  rejectionmessage?: string;
  testid: number;
  billingid: number;
  approvalstatus?: number;
  sampleMessage?: string;
  phelobotomist: number;
  ascensionid: number;
  redraw?: number;
  redrawOrderDate?: Date | string;
  samplevalidatedon?: Date | string;
  validatedby?: number;
  disputedby?: number;
  disputedon?: Date | string;
  disputereason?: string;
  resolution?: string;
  samplemessage?: string;
  isRedraw: number;
};

export type PrimeLimsTablesampletype = {
  id: number;
  name: string;
  addedon: Date | string;
};

export type PrimeLimsTablescanreport = {
  id: number;
  patientid: number;
  billingid: number;
  testid: number;
  scan: string;
  created_on: Date | string;
  updated_on?: Date | string;
  content: string;
  sonographer: string;
  employeeid?: number;
};

export type PrimeLimsTableservicestracking = {
  id: number;
  serviceid: number;
  employeeid: number;
  status: number;
  comments: string;
  createdOn: Date | string;
  updatedOn?: Date | string;
  isConsulation?: number;
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
  literature?: string;
  created_on: Date | string;
  updated_on?: Date | string;
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
  start_time: string;
  end_time: string;
  break_duration_minutes?: number;
  is_active?: number;
  created_at: Date | string;
  color?: string;
  starttime: string;
  endtime: string;
};

export type PrimeLimsTablesmsevents = {
  id: number;
  name: string;
  description?: string;
  trigger?: string;
  attachedscheduler: number;
  messageheader?: string;
  activated: number;
  created_at: Date | string;
};

export type PrimeLimsTablesms_schedules = {
  id: number;
  template_id: number;
  recipient_type: string;
  recipient_ids?: string;
  send_at: Date | string;
  frequency?: string;
  status?: string;
  created_by?: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PrimeLimsTablesms_templates = {
  id: number;
  name: string;
  message_template: string;
  description?: string;
  category: string;
  is_active?: number;
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
  is_active?: number;
  license_key: string;
  max_devices?: number;
  current_count?: number;
  created_at: Date | string;
};

export type PrimeLimsTabletasks = {
  id: number;
  name: string;
  description?: string;
  startDate: Date | string;
  endDate: Date | string;
  priority: string;
  frequency: string;
  assignedTo: string;
  completed?: number;
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
  createdBy?: string;
  updatedOn: Date | string;
  conditionConstraint: string;
};

export type PrimeLimsTabletestcreationrules = {
  id: number;
  testid: number;
  name: string;
  field?: string;
  value?: string;
  hasunits?: number;
  units?: string;
  plan: string;
  plain?: string;
  ordering?: number;
  isValueTracked?: number;
  textReference?: string;
  upperlimit?: string;
  lowerlimit?: string;
  category?: string;
  options?: string;
  undercategory?: number;
  categoryid?: number;
  valueAlert?: string;
  alert?: string;
};

export type PrimeLimsTabletestdetailcategory = {
  categoryid: number;
  categoryname: string;
  testid: number;
  createdby: string;
  updatedby?: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted?: number;
};

export type PrimeLimsTabletestdetails = {
  id: number;
  testid?: number;
  testcost?: number;
  hasManual?: number;
  procedureCode?: string;
  pre_Tat?: number;
  tat?: number;
  post_Tat?: number;
  tatCount?: number;
  updatedon?: Date | string;
  updatedby: number;
  isoutsourced: number;
  showtrend: number;
  testprice?: number;
  hasGenderVariation: number;
  hasChildrenLimit: number;
  childrenlimit: string;
  useLiterature?: number;
  hasDrugs: number;
  outSourcingList?: string;
  post_TatEvaluation: string;
  pre_TatEvaluation: string;
  tatEvaluation: string;
};

export type PrimeLimsTabletestsynchronization = {
  synid: number;
  status: string;
  requestedon: Date | string;
  updatedon?: number;
  targetTest: string;
  lastSyncdatetime?: Date | string;
  requestedby: number;
};

export type PrimeLimsTabletest_ascension = {
  id: number;
  testid: number;
  billingid: number;
  collection?: string;
  processing?: string;
  ready?: string;
  processing_date?: Date | string;
  collection_date?: Date | string;
  ready_date?: Date | string;
  printcount?: number;
  printedOn?: Date | string;
  approvalStatus: number;
  Scientist?: number;
  ApprovedBy?: number;
  declineMessage?: string;
  actionPlan?: string;
  month: number;
  year: number;
  serviceid: number;
  ascension_date: Date | string;
  collectionStartDate?: Date | string;
  collectionEndDate?: Date | string;
  processingStartDate?: Date | string;
  processingEndDate?: Date | string;
  resultEntryStart?: Date | string;
  resultEntryEnd?: Date | string;
  sampleCollectedBy: number;
  sampleProcessedBy?: number;
  resultEnteredBy?: number;
};

export type PrimeLimsTabletest_billing = {
  billingid: number;
  patientid: number;
  totalTransactionCost?: number;
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
  day?: number;
  amountIncurredDueTax: number;
  lastupdated: Date | string;
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
  firstWitnessPurpose?: string;
  firstWitnessDate?: Date | string;
  secondWitnessDate?: Date | string;
  thirdWitnessDate?: Date | string;
  isRefundCompleted: number;
  isRefundInitiated: number;
  initiatedBy?: number;
  secondWitnessPurpose?: string;
  thirdWitnessPurpose?: string;
  isRefundApproved: number;
  approvalDate: number;
  approvedby?: number;
  amountRefunded: number;
};

export type PrimeLimsTabletest_panels = {
  prim_key: number;
  name: string;
  category: number;
  price: number;
  created_on: Date | string;
  sample: number;
  description?: string;
  sample_container: string;
  unit: string;
  qty_required?: string;
  shorttext?: string;
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
  value?: string;
  originalvalue?: string;
  created_on: Date | string;
  updated_on?: Date | string;
  employeeid: number;
  entrymode?: string;
  fieldid: number;
};

export type PrimeLimsTabletest_results_audit_log = {
  id: number;
  field: string;
  ascensionid: number;
  billingid: number;
  patientid: number;
  testid: number;
  previous_value?: string;
  previous_originalvalue?: string;
  employeeid: number;
  fieldid: number;
  entrymode?: string;
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
  value?: string;
  originalvalue?: string;
  created_on: Date | string;
  updated_on?: Date | string;
  employeeid: number;
  entrymode?: string;
  fieldid: number;
};

export type PrimeLimsTableultrasoundtemplates = {
  keyid: number;
  templateid: number;
  field: string;
  value: string;
  lastupdatedon: Date | string;
  fieldid: number;
};

export type PrimeLimsTableultrasoundtemplatesmapper = {
  keyid: number;
  testid: number;
  name: string;
  associatedbodypart?: string;
  createdOn: Date | string;
  createdby: number;
  visibletoAll: number;
};

export type PrimeLimsTableusers = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role?: string;
  is_active?: number;
  created_at: Date | string;
  updated_at: Date | string;
  USER?: string;
  CURRENT_CONNECTIONS: number;
  TOTAL_CONNECTIONS: number;
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

