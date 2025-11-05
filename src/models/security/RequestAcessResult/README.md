# Medical Records Access Control System

## Overview

This system implements a comprehensive access control mechanism for medical records, ensuring secure and controlled access to patient results with proper approval workflows and time-based restrictions.

## Core Components

### 1. Access Request Types
- **access**: Permission to view medical results
- **edit**: Permission to modify medical results

### 2. Request Status Flow
- **pending**: Request submitted, awaiting approval
- **granted**: Request approved, access allowed within time window
- **revoked**: Request manually revoked by administrator
- **expired**: Request automatically expired due to time limits

### 3. Access Windows
- **Global Settings**: Default time limits for all users
- **Employee-Specific Settings**: Custom time limits per user role
- **Default Periods**:
  - Access: 24 hours
  - Edit: 24 hours

## Logic Flow: verifyWindowPeriod()

The `verifyWindowPeriod()` method determines whether a user has valid access to a medical record.

### Scenario 1: Existing Granted Request
```typescript
if (existingRequests && existingRequests.status === 'granted') {
    // Check if granted access is still within time window
}
```

**Process:**
1. Retrieve user's effective access window settings
2. Calculate expiration time from `grantedAt` timestamp
3. Check if current time is before expiration
4. For edit requests: Verify user is the record creator (unless authorized)
5. Return true if valid, false if expired

### Scenario 2: No Previous Requests (New Access)
```typescript
if (!existingRequests) {
    // Check if within initial access window from record timestamp
}
```

**Process:**
1. Extract record's creation/update timestamp
2. Calculate access window from that timestamp
3. Allow access if current time is within window (for requesting access)
4. This enables users to request access for recent records

### Scenario 3: Previous Requests Exist But Not Granted
```typescript
// If there are previous requests but none are currently granted, deny access
return false;
```

**Process:**
- If latest request is expired/revoked/pending → Deny access
- User must submit new request for approval
- Prevents access based on old record timestamps when approved access has expired

## Key Security Features

### 1. Time-Based Expiration
- Access automatically expires after configured time window
- Prevents indefinite access permissions
- Granular control per user and access type

### 2. Edit Restrictions
- Edit access restricted to record creator by default
- Prevents unauthorized modifications
- Maintains data integrity

### 3. Approval Workflow
- All access requests require administrator approval
- Reason and urgency tracking for audit purposes
- Clear approval trail

### 4. Comprehensive Logging
- All access attempts logged with timestamps
- Patient information included in history
- Full audit trail for compliance

## Database Schema

### result_access_requests Table
- `id`: Primary key
- `patientid`: Patient identifier
- `staffid`: Requesting staff member
- `requestType`: 'access' or 'edit'
- `requestedAt`: Request submission timestamp
- `status`: Current request status
- `ascensionid`: Medical record identifier
- `grantedAt`: Approval timestamp
- `revokedAt`: Revocation timestamp
- `expiredAt`: Expiration timestamp
- `accessedAt`: Last access timestamp
- `reason`: Access reason
- `urgency`: Urgency level (low/medium/high/critical)

## API Endpoints

### Request Access
```
POST /api/v1/security-features/request-access
```
Submit new access request with reason and urgency.

### Grant Access
```
PUT /api/v1/security-features/grant/:requestId
```
Approve pending access request.

### Verify Access
```
POST /api/v1/security-features/verify
```
Check if user has valid access to specific record.

### Access History
```
GET /api/v1/security-features/history
```
Retrieve access request history with filtering options.

## Configuration

### Access Windows
Configure time limits through the access_windows table:
- Global settings apply to all users
- Employee-specific settings override globals
- Support for different time units (hours, days, weeks, months)

## Security Benefits

1. **Controlled Access**: Only approved users can access sensitive data
2. **Time Limits**: Automatic expiration prevents stale permissions
3. **Audit Trail**: Complete logging of all access attempts
4. **Data Integrity**: Edit restrictions prevent unauthorized changes
5. **Compliance**: Supports medical data regulatory requirements
6. **Flexibility**: Configurable per user and access type

## Error Handling

- Invalid requests return appropriate error messages
- Automatic cleanup of expired permissions
- Comprehensive error logging for debugging
- Graceful handling of edge cases

## Maintenance

### Automatic Cleanup
- `expireExpiredRequests()` method runs periodically
- Removes stale permissions
- Maintains database performance

### Monitoring
- Console logging for access verification
- Timestamp tracking for debugging
- Status monitoring for system health