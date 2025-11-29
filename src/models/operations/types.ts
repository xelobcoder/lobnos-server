export const enum OperationsFailures {
	notready = "billingid  not ready for result entry",
	unfoundID = "such id not found",
	organizationalPricingDiscountedIssue = 'There is an issue with the organizational pricing discounted values provided',
	OrganizationExist = "Organization With Such Name Already Exist",
	TestExist = "Test With Such Name Already Exist",
	sameTestNameProvided = "Same Test Name provided for update",
	applicableTestNotFound = "applicableTest Not found or has invalid content",
	applicableOrganizationNotFound = "applicableOrganization Not found or has invalid content",
	invalidTestLength = "invalid test length provided",
	noArgumentsProvided = "No Arguments Provided",
	invalidResponseBodyParams = 'Invalid response body parameters.',
	invalidRequestParams = 'Invalid request query parameters',
	invalidResquestQuery = 'Invalid request query parameters.',
	billingStrategyNotFound = 'Billing strategy not found.',
	invalidDateRange = 'Invalid date range provided.',
	invalidEmailFormat = 'Invalid email format provided.',
	billingSessionAlreadyEnded = "sale session already ended",
	billingSessionNotFound = "sale session not found",
	billingStrategyAlreadyExists = 'Billing strategy already exists for the given entity.',
	billingStrategyNotFoundForEntity = 'Billing strategy not found for the given entity.',
	billingStrategyExpired = 'Billing strategy has expired.',
	queryExecutionFailed = 'Query execution failed.',
	accessWindowExpired = "Access window period has expired.",
	NothaveDifferentPriceList = "Different Pricing not selected",
	refundAlreadyConcluded = "Refund already concluded for this service",
	EmptyTestList = "Empty TestList Provided",
	billingLocked = 'Billing is locked , hence action cannot be carried out',
	notFound = 'Resource not found.',
	inActiveBillingSession = 'No active billing session found for the current date.',
	unauthorized = 'Unauthorized access.',
	internalServerError = 'An internal server error occurred.',
	dontHavePermission = "You do not have permission to delete this resources",
	dontHaveAccessPermission = "You do not have permission to access this resources",
	invalidRequestBodyType = "The type of request body is invalid",
	sessionNotFound = "No active sales session found for the current date.",
	cannotCreateSessionForDate = "Cannot create a session for the provided date. A session already exists for this date.",
	allRequestedServicesAlreadyExistForThisTransaction = "All requested services already exist for this transaction",
	someRequestedServicesAlreadyExistForThisTransaction = "some requested services already exist for this transaction, please kindly check the previous billing of this transaction",
	resourceExist = "This resource already exist",

	maximumResultValidation = "Maximun result validation reached",

	minimumResultValidation = "Mininum result approval not reached",

	nopermissiontobethirdwitness = " You do not have the permission to be a third witness",

	ER_NO_SUCH_TABLE = 'ER_NO_SUCH_TABLE',
	notapproved = "refund request not approved hence refunding not possible",
	refundAmmountExceeded = "Refund Amount exceeded. Hence Refund cannot be done",
	paidlessthanPayableAmount = "Paid amount is less than the payable amount",
	paymentExceedsPayableAmount = "Payment exceeds payable amount",

	invalidTokenProvided = "token provided is invalid",
	invalidPhoneNumber = "Valid phone number required",
	invalidEmail = "Valid  email required",

}


export const enum MysqlOperationsFailure {
	duplicates = "Duplicates.Item already Exist"
}



export const ascensionStages = {
	collectionStartDate: "collectionStartDate",
	collectionEndDate: "collectionEndDate",
	processingStartDate: 'processingStartDate',
	processingEndDate: 'processingEndDate',
	resultEntryStart: "resultEntryStart",
	resultEntryEnd: 'resultEntryEnd',
	printing: "printing"
}


export type durationTimeFormat = {
	hour: number,
	min: number,
	seconds: number
}


export type resultQuery = {
	from: string;
	to: string;
	patientid: number;
	fullname?: string;
	billingid: number;
	sortingwise: 'ASC' | 'DESC';
	count: number;
	page: number;
};




export type ProcessedScan = {
	search: string,
	from: string,
	count: number,
	page: number,
	to: string,
	branchid?: number
}



export interface OperationsFilterResultEntry {
	fullname?: string;
	count?: number;
	page?: number;
	departmentid?: number | string;
	testid?: number;
	status?: string;
	tenantId: string;
	billingid?: number;
	branchid: number;
	from?: string;
	to?: string;
}



export type updateSampleStatusCollection = {
	approvalstatus: number,
	billingid: number,
	rejectionmessage?: null | string,
	id?: number,
	testid: number,
	validatedby: number,
	validatedon?: Date | string
	ascensionId?: number
}



export type ascensionStageRequestQueryTypes = {
	from: (string | Date) | null,
	to: (string | Date) | null,
	stage: string,
	sortby?: 'ASC' | 'DESC',
	clinicianId: number,
	organizationId: number,
	searchString: string | null,
	isUltrasound: boolean
}



export type validatorsFinalFormatType = {
	username: string;
	employeeid: number;
	role: string;
	lastupdatedon?: Date | string
};