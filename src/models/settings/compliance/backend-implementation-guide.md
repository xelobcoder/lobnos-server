# Incident Management API - Frontend Integration Guide

## Recent Database Schema Changes

The following table alterations have been made that affect API payloads:

### 1. Audit Trail Table Changes
- **Field Change:** `user` (string) → `employeeId` (integer)
- **Purpose:** Better referential integrity with employee records

### 2. Incidents Table Changes
- **Field Change:** `reported_by` (string) → `employeeId` (integer)
- **Purpose:** Consistent employee referencing across the system

## Employee Information Joins

The API now includes employee information through LEFT JOINs with the `roles` table:

### Incident Endpoints
- `GET /api/compliance/incidents` - Returns employee info for each incident
- `GET /api/compliance/incidents/{id}` - Returns employee info for the incident

### Audit Trail Endpoints
- `GET /api/compliance/incidents/{id}/audit-trail` - Returns employee info for each audit entry
- `GET /api/compliance/audit-trail` - Returns employee info for each audit entry

## Frontend Payload Changes Required

### Incident Response Payload Changes

#### Before (Old Response):
```json
{
  "id": "INC-123456789",
  "type": "patient-safety",
  "title": "Incident Title",
  "description": "Description",
  "severity": "high",
  "status": "reported",
  "reportedBy": "john.doe@example.com",
  "reportedAt": "2025-11-08T10:30:00Z",
  "affectedParties": "Patient information",
  "location": "Lab Room 101",
  "immediateActions": "Isolated the area"
}
```

#### After (New Response):
```json
{
  "id": "INC-123456789",
  "type": "patient-safety",
  "title": "Incident Title",
  "description": "Description",
  "severity": "high",
  "status": "reported",
  "employeeId": 123,
  "reportedAt": "2025-11-08T10:30:00Z",
  "affectedParties": "Patient information",
  "location": "Lab Room 101",
  "immediateActions": "Isolated the area",
  "reportedByUsername": "john.doe",
  "reportedByEmail": "john.doe@example.com",
  "reportedByRole": "Lab Technician"
}
```

**Change Required:** Rename `reportedBy` property to `employeeId` and handle as integer. New employee information fields are now available.

### Audit Trail Response Payload Changes

#### Before (Old Response):
```json
{
  "data": [
    {
      "id": "AUDIT-123456789-abc123",
      "incidentId": "INC-123456789",
      "timestamp": "2025-11-08T10:30:00Z",
      "action": "CREATE",
      "user": "john.doe@example.com",
      "oldValue": null,
      "newValue": "{\"type\":\"patient-safety\",...}",
      "details": "Incident created with type: patient-safety, severity: high",
      "createdAt": "2025-11-08T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "count": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

#### After (New Response):
```json
{
  "data": [
    {
      "id": "AUDIT-123456789-abc123",
      "incidentId": "INC-123456789",
      "timestamp": "2025-11-08T10:30:00Z",
      "action": "CREATE",
      "employeeId": 123,
      "oldValue": null,
      "newValue": "{\"type\":\"patient-safety\",...}",
      "details": "Incident created with type: patient-safety, severity: high",
      "createdAt": "2025-11-08T10:30:00Z",
      "employeeUsername": "john.doe",
      "employeeEmail": "john.doe@example.com",
      "employeeRole": "Lab Technician"
    }
  ],
  "pagination": {
    "page": 1,
    "count": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

**Changes Required:**
- Rename `user` property to `employeeId`
- Handle `employeeId` as integer instead of string
- New employee information fields are now available

### Query Parameter Changes for Filtering

#### Audit Trail Filtering

**Before:**
```
GET /api/compliance/incidents/{id}/audit-trail?user=john.doe@example.com
GET /api/compliance/audit-trail?user=john.doe@example.com
```

**After:**
```
GET /api/compliance/incidents/{id}/audit-trail?employeeId=123
GET /api/compliance/audit-trail?employeeId=123
```

**Change Required:** Use `employeeId` as query parameter with integer value instead of `user` string.

## Implementation Checklist for Frontend Developers

- [ ] Update incident display components to show `employeeId` instead of `reportedBy`
- [ ] Update audit trail components to show `employeeId` instead of `user`
- [ ] Change audit trail filtering from `user` to `employeeId` parameter
- [ ] Update TypeScript interfaces to reflect `employeeId: number` instead of string fields
- [ ] Add display of employee information (username, email, role) in UI components
- [ ] Test incident creation, updates, and audit trail retrieval
- [ ] Verify employee ID resolution for display (data is now included in API responses)

## New Employee Information Fields

### Incident Employee Fields:
- `reportedByUsername`: Employee's username
- `reportedByEmail`: Employee's email address
- `reportedByRole`: Employee's role/position

### Audit Trail Employee Fields:
- `employeeUsername`: Employee's username who performed the action
- `employeeEmail`: Employee's email address
- `employeeRole`: Employee's role/position

## Backward Compatibility Notes

- The backend automatically extracts `employeeId` from authenticated user context
- No changes required in incident creation requests
- All existing functionality remains the same, only field names and types changed
- Employee information is now included in responses via LEFT JOINs

## Migration Timeline

- Database migration applied: ✅
- Backend code updated with employee joins: ✅
- Frontend updates required: ⏳ (See checklist above)

## Contact

For questions about these changes, refer to the incident management API documentation or contact the backend development team.
