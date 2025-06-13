# Clinician Analytics Controller Documentation

## Overview
The `ClinicianAnalyticsHandlers` class provides REST API endpoints for clinician performance analytics and operational insights. Implements 18 distinct analytics endpoints with validation and error handling.

## Key Features
- 17 granular analytics endpoints + complete dashboard endpoint
- Standardized request validation
- Consistent error handling
- Pagination support
- Year-filtered analytics
- Comprehensive dashboard aggregation

## API Endpoints
| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/v1/clinician/anal/overall/:clinicianId` | GET | `clinicianId` | Overall performance metrics |
| `/api/v1/clinician/anal/monthly/:clinicianId` | GET | `clinicianId, year?` | Monthly breakdown |
| `/api/v1/clinician/anal/dashboard/:clinicianId` | GET | `clinicianId, year?` | Complete dashboard data |

**Full endpoint list:** Defined in <mcfile name="clinicians-analytics.ts" path="src\controllers\analytics\clinicians-analytics\clinicians-analytics.ts"></mcfile>

## Core Methods
### `getAllAnalytics()`
Aggregates 17 data sources into a single dashboard response:
```typescript
public async getAllAnalytics(req: BaseAnalyticsRequest, res: Response) {
    // Concurrent data fetching from multiple sources
    // Returns structured DashboardResponse
}
```