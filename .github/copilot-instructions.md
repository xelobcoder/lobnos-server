# Lobnos Server - AI Coding Agent Instructions

## Project Overview
Laboratory Information Management System (LIMS) backend built with Express/TypeScript, using Knex for MySQL multi-tenancy support. This is a healthcare-focused system managing patient registration, test results, billing, inventory, compliance, and CRM.

## Architecture Patterns

### Multi-Tenancy Design
- **Database Strategy**: Each tenant gets a separate MySQL database (configured in `src/hooks/configuration.ts`)
- **Toggle**: `configuration.isMultiTenant` (currently `false` for single-tenant mode)
- **Database Naming**: `primetenant{tenantId}` format via `configuration.tenancyNaming()`
- **Connection Management**: `KnexConnection(tenantId)` returns promise-based Knex instance
  ```typescript
  // Located in src/database/KnexConnections.ts
  const KnexConnection = async (tenantId: number) => {
    return configuration.isMultiTenant 
      ? await KnexConnectionTenant(tenantId)
      : singleTenantKnexInstance;
  }
  ```
  - Multi-tenant: `KnexConnectionTenant(tenantId)` - creates/selects tenant database
  - Single-tenant: `singleTenantKnexInstance` - uses default connection
- **Query Pattern**: Always await `KnexConnection` before using: `const connection = await this.connection;`

### Domain Organization
The codebase is organized into 35+ domain areas under `src/models/`:
- **Core Operations**: `operations/`, `registration/`, `patients/`
- **Billing & Finance**: `billing/`, `invoice/`, `commissions/`, `expenses/`
- **Clinical**: `clinicians/`, `medicalRecords/`, `result/`, `samples/`
- **Inventory**: `inventory/`, `drugs/`, `suppliers/`
- **Compliance & Quality**: `compliance/`, `QualityControl/`, `security/`
- **CRM & Analytics**: `leads/`, `customers/`, `analytics/`
- **Configuration**: `settings/`, `applicationsettings/`, `organization/`
- **Communication**: `sms/`, `EmailServices/`, `notifications/`
- **Multi-tenancy**: `Tenancy/`

### Controller Architecture
- **Location**: `src/controllers/{domain}/{feature}/`
- **Naming Patterns**:
  - Class-based with static/instance methods: `LeadsAnalyticsController.getLeadsAnalytics`
  - Handler functions: `getCliniciansHandler`, `updateBillingHandler`
  - Controller classes with constructor DI: `new InventoryItemController()`
- **Route Pattern**: Specific routes BEFORE parameterized routes to avoid conflicts
  ```typescript
  router.get('/analytics', AnalyticsController.method);  // BEFORE /:id
  router.get('/:id', getById);  // After specific routes
  ```
- **Route Files**: Typically `route.ts` or `routes.ts` in controller directories
- **Main Router**: `src/app.ts` aggregates all domain routers with `app.use()`

### Data Layer Patterns

#### Repository Pattern
Classes wrapping database operations with constructor-based tenancy:
```typescript
export class ExpenseInvoiceRepo {
  constructor(private tenantId: number) {}
  
  async getInvoiceById(invoiceId: number): Promise<any> {
    const connection = await KnexConnection(this.tenantId);
    return connection('expense_invoices').where({ id: invoiceId }).first();
  }
}
```

#### Service Layer Pattern
Business logic orchestration with dependency injection:
```typescript
export class PackageService {
  constructor(
    private packageRepo: IPackageRepository,
    private clinicianPackageRepo: IClinicianPackageRepository,
    private organizationPackageRepo: IOrganizationPackageRepository,
    private packageTestRepo: IPackageTestRepository
  ) {}
}

// Factory pattern for service instantiation
export const createPackageService = () => {
  const packageRepo = new PackageRepository();
  const clinicianPackageRepo = new ClinicianPackageRepository();
  // ... instantiate dependencies
  return new PackageService(packageRepo, clinicianPackageRepo, ...);
};
```

#### Model Pattern
Legacy pattern using class instances with methods:
```typescript
export class Services {
  constructor(private serviceid: number) {}
  
  async createAService(tenantId: number, name: string, price: number, employeeid: number): Promise<boolean | string> {
    try {
      const result = await promisifyQuery(tenantId, q_create_service, [name, price, employeeid]);
      return rowAffected(result);
    } catch (error) {
      return error?.code === "ER_DUP_ENTRY" ? MysqlOperationsFailure.duplicates : 'ERROR';
    }
  }
}
```

#### Analytics Pattern
Separate query builders + aggregation services:
1. `{Feature}AnalyticsWithDate.ts` - Query methods returning database results
2. `{Feature}Analytics.ts` - Aggregates results from query builder
3. `{Feature}AnalyticsController.ts` - HTTP request handling

## Authentication & Authorization

### Authentication Flow
1. **Cookie Parsing**: `parseCookies()` extracts token from `Cookie` header
2. **Token Extraction**: `pls-prime-tenant-session` cookie contains JWT
3. **Token Validation**: `TokenValidator.validateAccessToken(token)` checks:
   - Token structure validity
   - Expiration status (`expired === true` check)
4. **Middleware**: `checkTokenExists` (in `src/middleware/validateTenancy.ts`)

```typescript
export const checkTokenExists = async (request: Request, response: Response, next: NextFunction) => {
  const bypassRoutes = ['/api/v1/prime/login', '/api/v1/settings/companyprofile/images', 
                       '/api/v1/prime/forgotpassword', '/api/v1/prime/resetpassword'];
  
  if (bypassRoutes.some(route => request.path.startsWith(route))) return next();
  
  const cookieHeader = request.headers['cookie'] as string;
  const cookiesObj = parseCookies(cookieHeader);
  const currentUserToken = cookiesObj['pls-prime-tenant-session'];
  
  if (!currentUserToken) return customError('Token not provided', 401, response);
  
  const isValid = await new TokenValidator().validateAccessToken(currentUserToken);
  if (!isValid) return customError("Invalid Token Provided", 500, response);
  if (isValid.expired) return customError('Token expired', 500, response);
  
  next();
};
```

### Authorization Patterns
- **Role-Based Middleware**:
  - `isAuthorizedRoleAdmin` - Checks user has 'admin' role via `User.getUserRole()`
  - `isAuthorizedRoleScientistPhelobotomist` - Checks for scientist/phelobotomist roles
  - `handleAuthenticationEmployee` - Validates employee authentication for billing operations
- **Resource-Based**: `billingIdChecker` - Validates billing/patient ID existence before access
- **Security Features**:
  - `RequestAccess.verifyWindowPeriod()` - Time-based result access control
  - `ValidateTenancyAgreement` - Checks tenant subscription status (multi-tenant only)

### Middleware Stack (in order)
```typescript
// src/app.ts
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(ValidateTenancyAgreement);  // Tenant validation
// app.use(checkTokenExists);       // Global auth (commented, applied per-route)
app.use(OutsourcedTestTracking);
// ... domain routers
```

## Error Handling Conventions

### Standard Response Functions
Located in `src/hooks/utility.ts` and `src/hooks/helper.ts`:

```typescript
// Basic error response
function customError(message: string, statusCode: number, response: Response) {
  response.status(statusCode).send({ 
    message: message || "Something went wrong", 
    statusCode: statusCode || 500, 
    status: "error" 
  });
}

// Specialized errors
function DuplicateError(response: Response) {
  return customError("Duplicate, item already exists", 409, response);
}
```

### SQL Error Handling
Use `PrimeSqlErrorHandler.handleError(error, response)` from `src/hooks/utility.ts`:

**Supported MySQL Error Codes**:
- `ER_DUP_ENTRY` → 409 "Duplicate entry"
- `ER_BAD_FIELD_ERROR` → 400 "Invalid field in query"
- `ER_NO_REFERENCED_ROW_2` → 400 "Foreign key constraint failed"
- `ER_PARSE_ERROR` → 400 "SQL syntax error"
- `ER_DATA_TOO_LONG` → 400 "Data exceeds column limit"
- `ER_NO_DEFAULT` → 400 "Missing required field"
- `ER_LOCK_WAIT_TIMEOUT` → 408 "Database lock timeout"
- `ER_ROW_IS_REFERENCED` → 409 "Cannot delete (referenced by other records)"
- `ER_TABLE_EXISTS_ERROR` → 409 "Table already exists"
- `ER_NO_SUCH_TABLE` → 404 "Table does not exist"
- `ER_ACCESS_DENIED_ERROR` → 403 "Database access denied"
- Plus 15+ additional error codes mapped to user-friendly messages

```typescript
catch (error) {
  PrimeSqlErrorHandler.handleError(error, response);
}
```

### Error Classes
- `PLSErrors` (in `src/Errors/PLSErrors.ts`): Custom error class with `message` and `code` properties
- `HTTPSTATUSERRORS` (in `src/Errors/HTTPErrors.ts`): Enum of HTTP status codes

### Response Patterns
**Success**: `{ status: "success", statusCode: 200, message: string, result/data: any }`
**Error**: `{ status: "error", statusCode: number, message: string }`
**Validation Error**: `{ success: false, error: { code: string, message: string } }`

## Database & Queries

### Knex Query Patterns
- **Async Connection**: ALWAYS `const connection = await this.connection;` before queries
- **Raw SQL**: Use `whereRaw('DATE(created_at) BETWEEN ? AND ?', [start, end])` for date filtering
- **Column Aliases**: Use `.select(connection.raw('SUM(...) AS alias'))` NOT `.sum(raw(...), 'alias')`
- **Aggregations**: Percentage calculations need subqueries:
  ```typescript
  connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM table WHERE ...)) * 100, 1) AS percentage')
  ```
- **Transactions**: Pass `trx` parameter through function chains for atomic operations
- **Parameterized Queries**: Use `?` placeholders with value arrays to prevent SQL injection

### Database Schema
- **Migrations**: Located in `src/cron/command-line-tool-database/migrations/`
- **Migration Tool**: `npm run migrate-sql` (executes SQL files in order)
- **Schema Pattern**: Uses numbered migrations (01.ts, 02.ts) + feature-specific files
- **Table Naming**: Snake_case convention (e.g., `dboservices`, `expense_invoices`, `organizationalbillingtable`)
- **Dynamic Tables**: Test results use `dboResult{testid}` pattern with audit logs `dboResultauditLog{testid}`

### Legacy Query Helper
`promisifyQuery(tenantId, query, params)` from `src/hooks/helper.ts` wraps callbacks in promises (being phased out in favor of Knex).

## Caching & Performance

### Redis Middleware
Located in `src/middleware/redis/`:
- **Pattern**: Caches GET requests for specific endpoints
- **Implementation**: `redisMiddleware.js` checks if Redis client available, falls through if not
- **Cache Function**: `useRedisCollection(request, response, next, sessionName)` checks cache, returns if found
- **Cached Endpoints**:
  - `/api/v1/stock/category` → `STOCKS_CATEGORY`
  - `/api/v1/applicationsettings/registration/fields` → `REG_FIELDS`
  - `/api/v1/authenticate/employee/token` → `SESSION_TOKEN`
- **Response Format**: `{ result: JSON.parse(data), statusCode: 200, status: 'success', caches: true }`
- **Graceful Degradation**: If Redis unavailable, continues to database query

## Development Workflows

### Running the Server
- **Development**: `npm run dev` (watches compiled JS with `--watch`)
- **TypeScript Compilation**: `npm run tsdev` (watches TS with `tsc --w`)
- **Port Management**: `npm run kill-port` before starting (port 5000 default)
- **Build**: `npm run build` (compiles to `./dist`)
- **Tasks**: Both TypeScript watch and server watch tasks auto-run on folder open (see `.vscode/tasks.json`)

### Critical Compilation Steps
1. TypeScript compiles to `./dist` directory
2. Server runs compiled JavaScript from `./dist/src/app.js`
3. BOTH TypeScript watch (`npm run tsdev`) AND server watch (`npm run dev`) should run simultaneously
4. Changes to `.ts` files require compilation before reflecting in running server

### Creating New Endpoints
1. **Create Model/Repository** (if needed): `src/models/{domain}/{feature}/{ClassName}.ts`
2. **Create Controller**: `src/controllers/{domain}/{feature}/{ControllerName}.ts`
3. **Add Routes**: Edit or create `src/controllers/{domain}/route.ts` or `routes.ts`
4. **Register Router**: Add to `src/app.ts` if new domain router: `app.use(newDomainRouter)`
5. **Test Compilation**: Check both TypeScript compilation and server restart

### Analytics API Pattern
When creating analytics endpoints:
1. Create `{Feature}AnalyticsWithDate.ts` with query methods returning database results
2. Create `{Feature}Analytics.ts` to aggregate results from query builder
3. Create `{Feature}AnalyticsController.ts` for request handling
4. Add route with `/analytics` endpoint BEFORE parameterized routes
5. Include date formatting: `new Date(dateStr).toISOString().split('T')[0]`
6. Always include `tenantId` query parameter validation

## Integration Points

### Request Flow
1. **Parsing**: Cookie parsing via `parseCookies()` → Body/query parsing (Express built-in)
2. **Global Middleware**: `ValidateTenancyAgreement` checks tenant status
3. **Route-Level Middleware**: `checkTokenExists` validates JWT (applied per-route)
4. **Domain Middleware**: `billingIdChecker`, `isAuthorizedRoleAdmin`, etc.
5. **Controller**: Extracts `tenantId` from query, validates parameters
6. **Service/Model**: Business logic with database operations
7. **Response**: `{ status, statusCode, message, data/result }`

### Query Parameters
- **Required**: `tenantId` in query string for all authenticated routes
- **Pattern**: `?tenantId={id}&other=value`
- **Validation**: Controllers parse and validate: `const tenantId = parseInt(req.query.tenantId as string)`
- **Multi-tenant Context**: Determines which database connection to use

### File Uploads
- **Middleware**: `createFileUploader(uploadDir)` from `src/models/uploads/fileuploads`
- **Routes**: `POST /api/v1/storage/prime/uploads` (single file)
- **Storage Paths**: `patients`, `receipts`, `expenses`, `organizations`
- **Serving Files**: `sendFileResponse(filePath, res)` from `src/hooks/utility.ts`

## Code Conventions

### TypeScript/JavaScript Mix
- **New Code**: TypeScript in `src/` (`.ts` files)
- **Legacy Code**: JavaScript files exist (`*.js`) - gradually being migrated
- **Imports**: Use ES6 imports (`import ... from ...`), compiled to CommonJS (`require`)
- **Type Safety**: Use interfaces/types from `src/interfaces/` and domain-specific type files

### Naming Conventions
- **Controllers**: `{Feature}Controller` or `{feature}Handler`
- **Models**: `{Feature}`, `{Feature}Service`, `{Feature}Repo`, `{Feature}Repository`
- **Routes**: `route.ts` or `routes.ts`
- **Queries**: SQL query strings prefixed with `q_` (e.g., `q_create_service`)
- **Constants**: UPPERCASE_SNAKE_CASE
- **Interfaces**: PascalCase with `I` prefix optional (e.g., `IExpenseRepository`, `OutsourcingOrganization`)

### Date Handling
- **Input**: Accept various formats but validate with `new Date()`
- **Database**: Always format as YYYY-MM-DD: `date.toISOString().split('T')[0]`
- **Filtering**: Use MySQL `DATE()` function in `whereRaw()` for date-only comparisons
- **Date Library**: Some modules use `luxon` (`DateTime`) for complex date operations

### Status/Enum Mappings
Check database schema for actual enum values:
- **Leads**: `status` uses `'closed_won'`, `'closed_lost'` (NOT `'converted'`, `'lost'`)
- **Incidents**: `type` = `'patient-safety' | 'quality' | 'security' | 'compliance'`
- **Payment Status**: `'Pending' | 'Approved' | 'Rejected' | 'Paid'`
- **Service Categories**: Check `serviceCategory` enum in billing models
- Always verify enum values against migration files or database schema

## Key Directories
- `src/controllers/` - HTTP request handlers (35+ domain subdirectories)
- `src/models/` - Business logic & data access (35+ domain subdirectories)
- `src/routes/` - Route definitions (some domains have dedicated route files)
- `src/middleware/` - Authentication, validation, error handling, Redis caching
- `src/database/` - Knex connection configuration, table schemas
- `src/services/` - Shared business logic services
- `src/repositories/` - Data access patterns (patient repositories, QC)
- `src/hooks/` - Utility functions, helpers, configuration
- `src/schemas/` - Validation schemas
- `src/interfaces/` - TypeScript interfaces
- `src/LobnosAuth/` - Authentication utilities
- `src/EmailServices/` - Email sending and templating
- `src/migrations/` - Database schema migrations
- `src/cron/` - Background jobs & database tools
- `src/Errors/` - Error classes and HTTP status enums
- `dist/` - Compiled JavaScript output

## Common Pitfalls
- ❌ Using `this.connection` directly without `await` (will fail for multi-tenant)
- ❌ Placing `/analytics` routes after `/:id` routes (will match as ID)
- ❌ Using Knex `.sum(raw(), 'alias')` syntax (doesn't work in MariaDB)
- ❌ Assuming status enum values without checking migrations
- ❌ Forgetting to format dates before passing to SQL queries
- ❌ Missing `tenantId` query parameter in analytics endpoints
- ❌ Not handling Redis unavailability gracefully (middleware should fall through)
- ❌ Forgetting to await `KnexConnection(tenantId)` before database operations
- ❌ Using `customError()` without response object
- ❌ Not validating JWT token expiration (`isValid.expired` check)
- ❌ Applying middleware globally when route-specific is needed
- ❌ Missing constructor dependency injection in service layer
- ❌ Not using transactions (`trx`) for multi-step database operations
