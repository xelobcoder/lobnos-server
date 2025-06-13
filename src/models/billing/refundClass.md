# RefundClass

The `RefundClass` is a TypeScript class that handles refund-related operations, including initiating refunds, approving refunds, verifying refundable amounts, and processing cashouts. It interacts with the database and other services to manage refund workflows.

## Table of Contents

- [Methods](#methods)
  - [initiateRefundofServices](#initiaterefundofservices)
  - [hasWitnessRefund](#haswitnessrefund)
  - [getAserviceRefundDetails](#getaservicerefunddetails)
  - [getAllRefundsWithPagination](#getallrefundswithpagination)
  - [refundItemProcessed](#refunditemprocessed)
  - [prepareServiceItemForResponseBulk](#prepareserviceitemforresponsebulk)
  - [prepareResponseData](#prepareresponsedata)
  - [serviceDifferentiatedToWithness](#servicedifferentiatedtowithness)
  - [processNonAdminServiceItem](#processnonadminserviceitem)
  - [getWithnessFromServiceItem](#getwithnessfromserviceitem)
  - [updateWitnessNote](#updatewitnessnote)
  - [getAllRefundInitiated](#getallrefundinitiated)
  - [getAllRefundCompleted](#getallrefundcompleted)
  - [getservicesRefundWithness](#getservicesrefundwithness)
  - [withnessStatus](#withnessstatus)
  - [updateWitnessOfRefund](#updatewitnessofrefund)
  - [updateWitnessStatus](#updatewitnessstatus)
  - [requestForServicesAsRefundWitness](#requestforservicesasrefundwitness)
  - [approveRequestedRefund](#approverequestedrefund)
  - [isServiceRefundApproved](#isservicerefundapproved)
  - [isServiceRefundConcluded](#isservicerefundconcluded)
  - [amountRefundableExceeded](#amountrefundableexceeded)
  - [issueOutCashOutOfRefund](#issueoutcashoutofrefund)
  - [calculateServiceRefundableAmount](#calculateservicerefundableamount)
  - [refundVerification](#refundverification)
  - [refundAllItemsOfTransaction](#refundallitemsoftransaction)

---

## Methods

### `initiateRefundofServices`

Initiates a refund for a service.

**Parameters:**
- `employeeid: number` - The ID of the employee initiating the refund.
- `serviceid: number` - The ID of the service to refund.
- `purpose: string` - The purpose of the refund.

**Returns:**
- `Promise<boolean>` - Returns `true` if the refund initiation is successful, otherwise `false`.

---

### `hasWitnessRefund`

Checks if a refund has a witness before.

**Parameters:**
- `trackId: number` - The track ID of the refund.
- `employeeid: number` - The ID of the employee.

**Returns:**
- `Promise<boolean>` - Returns `true` if a witness exists, otherwise `false`.

---

### `getAserviceRefundDetails`

Retrieves refund details for a specific service.

**Parameters:**
- `serviceid: number` - The ID of the service.
- `employeeid: number` - The ID of the employee.

**Returns:**
- `Promise<any>` - Returns the refund details or an error message.

---

### `getAllRefundsWithPagination`

Retrieves all refunds with pagination.

**Parameters:**
- `status: 'completed' | 'pending'` - The status of the refunds.
- `count: number` - The number of items per page.
- `page: number` - The page number.
- `employeeid: number` - The ID of the employee.

**Returns:**
- `Promise<any>` - Returns the paginated refund data.

---

### `refundItemProcessed`

Processes refund items and prepares them for response.

**Parameters:**
- `result: dbReturned[] | combinedType[]` - The refund data.
- `user: User` - The user object.
- `employeeid: number` - The ID of the employee.
- `role: string` - The role of the user.
- `status: string` - The status of the refund.

**Returns:**
- `Promise<any>` - Returns the processed refund data.

---

### `prepareServiceItemForResponseBulk`

Prepares service items for bulk response.

**Parameters:**
- `result: dbReturned[] | combinedType[]` - The refund data.
- `accessoriesBillingInformation: Billing` - The billing information.
- `role: string` - The role of the user.

**Returns:**
- `Promise<any[]>` - Returns the prepared response data.

---

### `prepareResponseData`

Prepares response data for a refund item.

**Parameters:**
- `accessoriesBillingInformation: Billing` - The billing information.
- `item: PrimeLimsTabledbobillingrefundtable & PrimeLimsTabledboservices & PrimeLimsTablebilling[] & witnessedType & { witnesses: withnessUpdatedType; billedby: string; canwitness: boolean; canEdit: boolean; }` - The refund item.

**Returns:**
- `Promise<any>` - Returns the response data.

---

### `serviceDifferentiatedToWithness`

Differentiates service items based on witness data.

**Parameters:**
- `item: withnessUpdatedType` - The refund item.
- `user: User` - The user object.
- `employeeid: number` - The ID of the employee.
- `role: string` - The role of the user.
- `status: string` - The status of the refund.

**Returns:**
- `Promise<any>` - Returns the differentiated service item.

---

### `processNonAdminServiceItem`

Processes non-admin service items.

**Parameters:**
- `witnesses: witnessedType[]` - The list of witnesses.
- `employeeid: number` - The ID of the employee.
- `status: string` - The status of the refund.
- `item: withnessUpdatedType` - The refund item.

**Returns:**
- `witnessedType[]` - Returns the processed witnesses.

---

### `getWithnessFromServiceItem`

Retrieves witness data from a service item.

**Parameters:**
- `item: withnessUpdatedType` - The refund item.
- `user: User` - The user object.
- `employeeid: number` - The ID of the employee.

**Returns:**
- `Promise<witnessedType[]>` - Returns the witness data.

---

### `updateWitnessNote`

Updates the witness note for a refund.

**Parameters:**
- `data: UpdatePreviousWitnessNoteBodyParams` - The witness note data.

---

### `getAllRefundInitiated`

Retrieves all initiated refunds.

**Returns:**
- `Promise<any>` - Returns the initiated refunds.

---

### `getAllRefundCompleted`

Retrieves all completed refunds.

**Returns:**
- `Promise<any>` - Returns the completed refunds.

---

### `getservicesRefundWithness`

Retrieves witness data for a service refund.

**Parameters:**
- `serviceid: number` - The ID of the service.

**Returns:**
- `Promise<any>` - Returns the witness data.

---

### `withnessStatus`

Checks the witness status for a service refund.

**Parameters:**
- `serviceid: number` - The ID of the service.

**Returns:**
- `Promise<string | boolean>` - Returns the witness status.

---

### `updateWitnessOfRefund`

Updates the witness for a refund.

**Parameters:**
- `data: { serviceid: number; employeeid: number; witnesStatus: string; reason: string; }` - The witness update data.

**Returns:**
- `Promise<boolean | string>` - Returns `true` if the update is successful, otherwise an error message.

---

### `updateWitnessStatus`

Updates the witness status for a refund.

**Parameters:**
- `witness: string` - The witness type.
- `serviceid: number` - The ID of the service.
- `employeeid: number` - The ID of the employee.
- `reason: string` - The reason for the update.

**Returns:**
- `Promise<boolean>` - Returns `true` if the update is successful, otherwise `false`.

---

### `requestForServicesAsRefundWitness`

Requests to be a witness for a service refund.

**Parameters:**
- `employeeid: number` - The ID of the employee.
- `serviceid: number` - The ID of the service.
- `reason: string` - The reason for the request.

**Returns:**
- `Promise<boolean | string>` - Returns `true` if the request is successful, otherwise an error message.

---

### `approveRequestedRefund`

Approves a requested refund.

**Parameters:**
- `serviceid: number` - The ID of the service.
- `employeeid: number` - The ID of the employee.
- `isApprove: number` - The approval status.

**Returns:**
- `Promise<boolean>` - Returns `true` if the approval is successful, otherwise `false`.

---

### `isServiceRefundApproved`

Checks if a service refund is approved.

**Parameters:**
- `serviceid: number` - The ID of the service.

**Returns:**
- `Promise<boolean>` - Returns `true` if the refund is approved, otherwise `false`.

---

### `isServiceRefundConcluded`

Checks if a service refund is concluded.

**Parameters:**
- `serviceid: number` - The ID of the service.

**Returns:**
- `Promise<boolean>` - Returns `true` if the refund is concluded, otherwise `false`.

---

### `amountRefundableExceeded`

Checks if the refundable amount is exceeded.

**Parameters:**
- `serviceId: number` - The ID of the service.

**Returns:**
- `Promise<boolean | null>` - Returns `true` if the amount is exceeded, otherwise `false` or `null`.

---

### `issueOutCashOutOfRefund`

Issues cash out for a refund.

**Parameters:**
- `records: updateRefundCashRequestBodyType` - The cashout data.

**Returns:**
- `Promise<any>` - Returns the result of the cashout operation.

---

### `calculateServiceRefundableAmount`

Calculates the refundable amount for a service.

**Parameters:**
- `serviceid: number` - The ID of the service.

**Returns:**
- `Promise<number | undefined>` - Returns the refundable amount.

---

### `refundVerification`

Verifies the refundable amount for a service.

**Parameters:**
- `serviceid: number` - The ID of the service.
- `billingid: number` - The ID of the billing.

**Returns:**
- `Promise<any>` - Returns the refundable amount or an error message.

---

### `refundAllItemsOfTransaction`

Refunds all items of a transaction.

**Parameters:**
- `billingid: number` - The ID of the billing.
- `employeeid: number` - The ID of the employee.
- `selectedPaymentMode: number` - The selected payment mode.

**Returns:**
- `Promise<boolean | string>` - Returns `true` if the refund is successful, otherwise an error message.

---
