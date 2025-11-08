# Frontend API Integration Guide - Audit Trail Endpoints

## 🔐 Authentication & Requirements
All endpoints require: `?tenantId=<number>` as a query parameter in the request body.

---

## 📊 Audit Trail Endpoints

### Get Audit Trail for Specific Incident
```
GET /api/v1/compliance/incidents/:id/audit-trail
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `count` (number, optional): Items per page (default: 10)
- `sortby` (string, optional): Sort order - 'ASC' or 'DESC' (default: 'DESC')
- `action` (string, optional): Filter by action type (CREATE, UPDATE, DELETE)
- `user` (string, optional): Filter by user who performed the action
- `start_date` (string, optional): Filter by start date (ISO format)
- `end_date` (string, optional): Filter by end date (ISO format)

**Request Body:**
```json
{
  "tenantId": 1
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "AUDIT-1731077161078-itngha3rp",
      "incidentId": "INC-1731077160739",
      "timestamp": "2025-11-08T15:26:01.078Z",
      "action": "CREATE",
      "user": "system",
      "oldValue": null,
      "newValue": "{\"id\":\"INC-1731077160739\",\"type\":\"patient-safety\",\"title\":\"Patient Safety Incident\",\"description\":\"Description of the incident\",\"severity\":\"high\",\"status\":\"reported\",\"reportedBy\":\"system\",\"reportedAt\":\"2025-11-08T15:26:00.739Z\",\"affectedParties\":\"Patients\",\"location\":\"Emergency Room\",\"immediateActions\":\"Immediate response taken\",\"regulatoryReporting\":true,\"escalatedTo\":[\"supervisor\",\"quality-manager\"],\"createdAt\":\"2025-11-08T15:26:00.739Z\",\"updatedAt\":\"2025-11-08T15:26:00.739Z\"}",
      "details": "Incident created with type: patient-safety, severity: high",
      "createdAt": "2025-11-08T15:26:01.078Z"
    },
    {
      "id": "AUDIT-1731077162078-abc123def",
      "incidentId": "INC-1731077160739",
      "timestamp": "2025-11-08T15:26:02.078Z",
      "action": "UPDATE",
      "user": "investigator_user",
      "oldValue": "{\"status\":\"reported\"}",
      "newValue": "{\"status\":\"investigating\"}",
      "details": "Incident updated: status",
      "createdAt": "2025-11-08T15:26:02.078Z"
    }
  ],
  "pagination": {
    "page": 1,
    "count": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

### Get All Audit Trails (Admin Endpoint)
```
GET /api/v1/compliance/audit-trail
```

**Query Parameters:** (Same as above)
- `page`, `count`, `sortby`, `action`, `user`, `start_date`, `end_date`

**Request Body:**
```json
{
  "tenantId": 1
}
```

**Response:** (Same structure as above, but includes audit trails for all incidents)

---

## 📋 Audit Trail Data Structure

### Audit Trail Entry
```json
{
  "id": "string",           // Unique audit entry ID
  "incidentId": "string",   // ID of the incident this audit entry belongs to
  "timestamp": "string",    // ISO timestamp when the action occurred
  "action": "string",       // Action type: CREATE, UPDATE, DELETE
  "user": "string",         // User who performed the action
  "oldValue": "string|null", // JSON string of previous state (null for CREATE)
  "newValue": "string|null", // JSON string of new state (null for DELETE)
  "details": "string",      // Human-readable description of the change
  "createdAt": "string"     // ISO timestamp when audit entry was created
}
```

### Pagination Response
```json
{
  "data": [AuditTrailEntry[]],
  "pagination": {
    "page": "number",
    "count": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

---

## ⚠️ Important Notes for Frontend

### Authentication & Authorization
- All requests must include `tenantId` in the request body
- User context is extracted from `userId` in request body or `req.user?.id`
- Audit trails are automatically created for all CREATE, UPDATE, DELETE operations on incidents

### Filtering & Pagination
- All list endpoints support pagination with `page` and `count` parameters
- Default page size is 10, maximum should be reasonable (e.g., 100)
- Filters can be combined (e.g., filter by user AND action type)

### Date Formats
- All dates are in ISO 8601 format (e.g., "2025-11-08T15:26:00.739Z")
- Use ISO format for `start_date` and `end_date` query parameters

### JSON Field Handling
- `oldValue` and `newValue` contain JSON strings representing the incident state
- Parse these fields on the frontend to display detailed change information

### Error Handling
- Success responses include the data array and pagination info
- Error responses include appropriate HTTP status codes and error messages

---

## 🎯 Endpoint Summary

### Audit Trails
```
GET    /api/v1/compliance/incidents/:id/audit-trail  # Get incident audit trail
GET    /api/v1/compliance/audit-trail               # Get all audit trails (admin)
```

---

## 🔍 Usage Examples

### Get recent changes for an incident
```javascript
GET /api/v1/compliance/incidents/INC-123/audit-trail?page=1&count=20&sortby=DESC
```

### Get all CREATE actions by a specific user
```javascript
GET /api/v1/compliance/audit-trail?action=CREATE&user=john.doe
```

### Get audit trails within date range
```javascript
GET /api/v1/compliance/audit-trail?start_date=2025-11-01T00:00:00.000Z&end_date=2025-11-08T23:59:59.999Z
```

### Parse audit trail changes
```javascript
// Example of parsing oldValue/newValue
const auditEntry = response.data[0];
const oldState = auditEntry.oldValue ? JSON.parse(auditEntry.oldValue) : null;
const newState = auditEntry.newValue ? JSON.parse(auditEntry.newValue) : null;

// Compare changes
if (oldState && newState) {
  const changedFields = Object.keys(newState).filter(key =>
    JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])
  );
  console.log('Changed fields:', changedFields);
}
```</content>
<parameter name="filePath">c:\Programming\PLS-DIFFERENT-VERSIONS\LobnosProfessionalVersion\lobnos-server\incident-management-api-guide.md