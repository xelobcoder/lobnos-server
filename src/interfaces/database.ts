// Database row interfaces derived from the current table column structure

export interface PrimeLimsTablebilling {
  billingid: number;
  patientid: number;

  totalTransactionCost: number;
  totalcost: number;
  paid: number;
  payable: number;
  voidedby: number;
  voidedat: string | Date,
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
  promoMethod: string | null;
  promoCodeId: number | null;

  status: string;

  relatedBillingId: number | null;

  isAdjustment: boolean;
  adjustedBy: number | null;
  adjustmentReason: string | null;
  adjustmentType: string | null;
  adjustmentdate: Date | null;
  adjustmentamount: number | null;

  islocked: boolean;

  additionalinformation: string | null;
  writeoff: number | null;
  lastupdatedby?: number;
}

export interface PrimeLimsTablebillinghx {
  KeyID: number;
  Billingid: number;
  Date: Date | string;
  PaymentMode: number;
  Amount: number;
  employeeid: number;
  type: string;
}

export interface PrimeLimsTablebillinghx {
  KeyID: number;
  Billingid: number;
  Date: Date | string;
  PaymentMode: number;
  Amount: number;
  employeeid: number;
  type: string;
}

export interface PrimeLimsTableclinicianbasicinfo {
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
}

export interface PrimeLimsTabledbobillingrefundtable {
  refundid: number;
  serviceid: number;
  refundedBy: number;
  firstWitness: number;
  firstWitnessPurpose?: string;
  firstWitnessDate?: Date | string;
  isRefundCompleted: number;
  isRefundInitiated: number;
  initiatedBy?: number;
  isRefundApproved: number;
  approvalDate: number;
  approvedby?: number;
  amountRefunded: number;
}

export interface PrimeLimsTabledboservices {
  serviceid: number;
  billingid: number;
  trackId: number;
  cost: number;
  employeeid: number;
  serviceCategory?: string;
  categoryTrackId: number;
  clinicianId?: number;
  organizationId?: number;
  voidedat: string | Date,
  registrationType?: string;
  voidedby: number;
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
}

export interface PrimeLimsTabledistricts {
  id: number;
  name: string;
  code: string;
  regionid?: number;
}

export interface PrimeLimsTableexpensesrecord {
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
}

export interface PrimeLimsTableexpensesrecord_audit_log {
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
}

export interface PrimeLimsTablenew_patients {
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
}

export interface PrimeLimsTableorganization {
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
}

export interface PrimeLimsTablepatientemmergencycontactinformation {
  keyid: number;
  patientid: number;
  emmergencyContactName?: string;
  emmergencyContactNumber?: string;
  relationship?: string;
  occupation?: string;
  address?: string;
}

export interface PrimeLimsTablepatients_credentials {
  id: number;
  patientid: number;
  username: string;
  password: string;
  updated: string;
  updated_on: Date | string;
}

export interface PrimeLimsTablepatientsaddress {
  keyid: number;
  patientid: number;
  area?: string;
  region?: string;
  gpsLocation?: string;
  address?: string;
  country?: string;
  district?: string;
}

export interface PrimeLimsTablepaymentmodes {
  KeyID: number;
  PaymentMode: string;
}

export interface PrimeLimsTableprivateinsurance {
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
}

export interface PrimeLimsTableregions {
  id: number;
  name: string;
  regioncode: string;
}

export interface PrimeLimsTableroles {
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
}

export interface PrimeLimsTablesalessessionmanager {
  sessionid: number;
  sessiondate: Date | string;
  session_started_by?: number;
  sessionendedon?: Date | string;
  openingamount?: number;
  amountreceivedby?: number;
  branchid?: number;
  validatedby?: number;
  handingoveramount?: number;
}

export interface PrimeLimsTablesamplestatus {
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
}

export interface PrimeLimsTablesetupliteraturereview {
  id: number;
  testid: number;
  literature?: string;
  created_on: Date | string;
  updated_on?: Date | string;
}

export interface PrimeLimsTabletasks {
  id: number;
  name: string;
  description?: string;
  startDate: Date | string;
  endDate: Date | string;
  priority: string;
  frequency: string;
  assignedTo: string;
  completed?: number;
}

export interface PrimeLimsTabletest_ascension {
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
}

export interface PrimeLimsTabletest_panels {
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
}

export interface PrimeLimsTabletest_results {
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
}

export interface PrimeLimsTabletestdetailcategory {
  categoryid: number;
  categoryname: string;
  testid: number;
  createdby: string;
  updatedby?: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted?: number;
}

export interface PrimeLimsTabletestdetails {
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
}
