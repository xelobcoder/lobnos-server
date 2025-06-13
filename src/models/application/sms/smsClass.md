# PrimeSmsServices Documentation

This document describes the **PrimeSmsServices** class and its methods. The class provides functionality for managing SMS templates and SMS messages including creation, retrieval, updating, deletion, and sending. It leverages several helper functions and database query templates to interact with the underlying database.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Imports and Dependencies](#imports-and-dependencies)
- [Class Overview](#class-overview)
- [Methods](#methods)
  - [createNewSmsTemplate](#createnewsmstemplate)
  - [readSmsTemplateById](#readsmstemplatebyid)
  - [readSmsTemplatesWithPagination](#readsmstemplateswithpagination)
  - [updateSmsTemplateById](#updatesmstemplatebyid)
  - [deleteSmsTemplateById](#deletesmstemplatebyid)
  - [createNewSmsMessage](#createnewsmsmessage)
  - [updateSmsMessageById](#updatesmsmessagebyid)
  - [deleteSmsMessageById](#deletesmsmessagebyid)
  - [readSmsMessageById](#readsmsmessagebyid)
  - [totalSmsCount](#totalsmscount)
  - [readAllsmsMessageWithPagination](#readallsmsmessagewithpagination)
  - [humanizeMessageRecipients](#humanizemessagerecipients)
  - [sendSmsMessage](#sendsmsmessage)
  - [sendScheduledMessageReachedAndUnsent](#sendscheduledmessagereachedandunsent)
- [Private Methods](#private-methods)
  - [humanizeSmsTemplateScheduled](#humanizesmstemplatescheduled)

---

## Prerequisites

- A working database schema containing SMS templates and SMS messages.
- Utility functions:
  - `promisifyQuery`
  - `paginationQuery`
  - `rowAffected`
- Query strings (SQL statements) imported from `./queries`.
- A working integration (or simulation) of an SMS sending service.
- The `TiifuWorkingClass` for retrieving recipient data based on various source types.

---

## Imports and Dependencies

The file imports the following:

- **Database Schemas & Types:**
  - `PrimeLimsTablesmsmessages`
  - `PrimeLimsTablesmstemplate`
- **Database Utility Class:**
  - `TiifuWorkingClass`
- **Helper Functions:**
  - `paginationQuery`, `promisifyQuery`, `rowAffected`
- **Error/Failure Types:**
  - `OperationsFailures`
- **SQL Query Templates:**
  - Multiple queries such as `q_create_new_sms_template`, `q_read_sms_template_by_id`, etc.

---

## Class Overview

The `PrimeSmsServices` class is designed as a service layer to handle all SMS-related operations. It includes methods to:

- Create, read, update, and delete SMS templates.
- Create, read, update, and delete SMS messages.
- Paginate through templates and messages.
- Process (or "humanize") message recipients by dynamically replacing placeholders in SMS content.
- Send SMS messages and handle scheduled messages.

---

## Methods

### createNewSmsTemplate

**Description:**  
Creates a new SMS template.

**Parameters:**  
- `data`: An object containing template details (**templateName**, **placeholders**, **smscontent**, **createdby**). The properties `tempateid` and `createdon` are excluded since they are auto-generated.

**Returns:**  
- A `Promise<boolean>` indicating if the record was successfully inserted.

**Implementation Highlights:**
- Converts `placeholders` to a JSON string (if provided).
- Uses `promisifyQuery` with the query `q_create_new_sms_template` to insert the template.
- Returns a boolean based on the affected row count.

---

### readSmsTemplateById

**Description:**  
Fetches an SMS template based on its ID.

**Parameters:**  
- `tempateid` (number): The unique ID of the SMS template.

**Returns:**  
- A `Promise<PrimeLimsTablesmstemplate | null>`.  
  Returns the template with the `placeholders` field parsed from JSON, or `null` if not found.

**Implementation Highlights:**
- Executes `q_read_sms_template_by_id` and processes the `placeholders` field if present.

---

### readSmsTemplatesWithPagination

**Description:**  
Retrieves a paginated list of SMS templates.

**Parameters:**  
- `page` (number): The page number.
- `count` (number): Number of items per page.

**Returns:**  
- A `Promise` resolving to an object containing:
  - `templates`: An array of SMS templates (with parsed `placeholders`).
  - `totalCount`: The total number of SMS templates.

**Implementation Highlights:**
- Uses `paginationQuery` with `q_read_sms_templates_with_pagination`.
- Retrieves the total count using `q_sms_template_count`.

---

### updateSmsTemplateById

**Description:**  
Updates an SMS template by its ID.

**Parameters:**  
- `tempateid` (number): The unique ID of the SMS template.
- `updates`: A partial object of the template data (excluding `tempateid` and `createdon`).

**Returns:**  
- A `Promise<boolean>` indicating whether the update was successful.

**Implementation Highlights:**
- Dynamically constructs the query based on provided fields.
- Converts the `placeholders` field to JSON if updated.
- Throws an error if no updates are provided.

---

### deleteSmsTemplateById

**Description:**  
Deletes an SMS template by its ID.

**Parameters:**  
- `tempateid` (number): The unique ID of the SMS template.

**Returns:**  
- A `Promise<boolean>` indicating if the deletion was successful.

**Implementation Highlights:**
- Uses `q_delete_sms_template_by_id` and checks the affected rows.

---

### createNewSmsMessage

**Description:**  
Creates a new SMS message record.

**Parameters:**  
- `data`: An object of type `PrimeLimsTablesmsmessages` containing message details (e.g., frequency, message content, template usage, scheduling details, and recipients).

**Returns:**  
- A `Promise<boolean>` indicating if the message was successfully inserted.

**Implementation Highlights:**
- Converts the `receipients` field to JSON if provided.
- Executes the insertion query using `promisifyQuery` with `q_sms_message_insert`.

---

### updateSmsMessageById

**Description:**  
Updates an SMS message by its ID.

**Parameters:**  
- `messageid` (number): The unique ID of the SMS message.
- `updates`: An object containing the fields to update.

**Returns:**  
- A `Promise<boolean>` indicating whether the update was successful.

**Implementation Highlights:**
- Processes the `receipients` field by converting it to JSON if necessary.
- Throws an error if no updates are provided.

---

### deleteSmsMessageById

**Description:**  
Deletes an SMS message by its ID.

**Parameters:**  
- `messageid` (number): The unique ID of the SMS message.

**Returns:**  
- A `Promise<boolean>` indicating if the deletion was successful.

**Implementation Highlights:**
- Uses `q_sms_message_delete` to remove the record.

---

### readSmsMessageById

**Description:**  
Retrieves an SMS message by its ID.

**Parameters:**  
- `messageid` (number): The unique ID of the SMS message.

**Returns:**  
- A `Promise<Record<string, any> | null>` containing the message details with the `receipients` field parsed from JSON, or `null` if not found.

---

### totalSmsCount

**Description:**  
Returns the total count of SMS messages, with an option to filter for unsent messages.

**Parameters:**  
- `isUnsent` (boolean, default `false`): If `true`, counts only unsent messages.

**Returns:**  
- A `Promise<number>` representing the total count.

**Implementation Highlights:**
- Uses `q_sms_messages_count` and modifies the query if filtering for unsent messages.

---

### readAllsmsMessageWithPagination

**Description:**  
Retrieves all SMS messages with pagination.

**Parameters:**  
- `count` (number): Number of items per page.
- `page` (number): The page number.

**Returns:**  
- A `Promise` resolving to an object containing:
  - `messages`: An array of SMS messages.
  - `totalCount`: The total number of messages.

**Implementation Highlights:**
- Uses `paginationQuery` with `q_read_sms_messages_with_pagination`.
- Processes the `placeholders` field for each message (if available).

---

### humanizeMessageRecipients

**Description:**  
Processes an SMS message to generate a human-friendly list of recipients by replacing template placeholders with actual recipient data.

**Parameters:**  
- `messageid` (number): The unique ID of the SMS message.

**Returns:**  
- A `Promise` with a list of humanized recipient objects or `null`.

**Implementation Highlights:**
- Internally calls the private method `humanizeSmsTemplateScheduled`.

---

### sendSmsMessage

**Description:**  
Sends an SMS message identified by its ID. This method fetches the message, processes its recipients, and integrates with an SMS sending service.

**Parameters:**  
- `messageid` (number): The unique ID of the SMS message.

**Returns:**  
- A `Promise<boolean>` indicating if the SMS was sent successfully.

**Implementation Highlights:**
- Throws errors if the message is not found or if there are no valid recipients.
- Simulates SMS sending (integration with an actual SMS service should replace the simulation).
- Marks the message as sent upon successful delivery.

---

### sendScheduledMessageReachedAndUnsent

**Description:**  
Retrieves SMS messages that have reached their scheduled date and are still unsent, with pagination.

**Parameters:**  
- `count` (number): Number of items per page.
- `page` (number): The page number.

**Returns:**  
- A `Promise` resolving to an object with:
  - `result`: An array of SMS messages.
  - `totalCount`: The total count of SMS messages.

**Implementation Highlights:**
- Uses `paginationQuery` with `q_sms_reached_scheduled_date_an_time_sms_unsent` to retrieve data.
- Logs the retrieved data and count.

---

## Private Methods

### humanizeSmsTemplateScheduled

**Description:**  
A private method to transform SMS template and recipient data into a human-readable format. It:
- Fetches the SMS template using its ID.
- Parses the template's content to identify dynamic placeholders.
- Retrieves detailed recipient data from various sources based on the template's source (e.g., Clients, Outsourcing, organization, clinicians, staffs).
- Constructs humanized message objects containing the recipient's mobile number (properly formatted), personalized message content, and name.

**Parameters:**  
- `data`: A partial object of type `PrimeLimsTablesmsmessages` containing fields such as `templateid`, `receipients`, and `isBulk`.

**Returns:**  
- A `Promise` resolving to an array of humanized recipient objects or a failure indicator (`OperationsFailures.notFound`).

**Implementation Highlights:**
- Uses the `TiifuWorkingClass` to fetch full recipient data based on different source types.
- Replaces placeholders in the SMS content with recipient-specific data.
- Formats mobile numbers to ensure a standard 10-digit format.

---

## Summary

The **PrimeSmsServices** class is a comprehensive service module for managing SMS operations, from template creation to message delivery. Each method is built to interact with a database via asynchronous queries and includes robust handling for dynamic content and recipient data processing. Integrating this service within a larger application would provide a solid foundation for SMS communication and management.
