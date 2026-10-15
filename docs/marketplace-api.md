# Marketplace API

Base path: `/api/v1/marketplace`. Marketplace data is stored in the shared
`SYSTEM_CONFIG_DATABASE`, bootstrapped idempotently at application startup. A
public request never creates or alters marketplace schema.

The bootstrap uses a fresh Knex schema builder for each operation. Reusing one
builder accumulates previous queries and can skip table creation or check columns
on a missing table. Fresh-install, repeat-run and legacy-column upgrades are
covered by `src/marketplace/MarketplaceBootstrapper.test.ts`.

### Startup database privileges and interrupted schema creation

The `SYSTEM_CONFIG_DB_USERNAME` account (or the configured application account
when that override is absent) needs `REFERENCES` on the shared control schema,
in addition to its existing schema-creation and runtime privileges. Do not
remove foreign keys or disable marketplace initialization to bypass this.

For the reported `primelab`@`localhost` installation, a MySQL administrator can
apply this narrowly scoped grant:

```sql
GRANT REFERENCES ON `primelabmaster_control`.* TO 'primelab'@'localhost';
SHOW GRANTS FOR 'primelab'@'localhost';
```

Use the actual control schema and matched account/host for other installations;
`SELECT CURRENT_USER(), DATABASE()` through the control connection identifies
them. Do not grant global privileges or `GRANT OPTION` to the runtime account.
Restart the application after deploying/building the fix and applying the grant.

MySQL can retain a table when the subsequent `ADD CONSTRAINT` fails. Startup
therefore reconciles all twelve marketplace foreign keys even for existing
tables, retaining the original cascade/restrict behavior. Missing privileges or
orphaned data still fail startup explicitly; no rows or tables are deleted.
After the underlying issue is corrected, the next startup retries only missing
constraints.

For the sibling website on the same machine, configure its server-only
`CORE_PLATFORM_API_URL` and `CORE_PLATFORM_ALLOWED_ORIGIN` to
`http://127.0.0.1:2300` (the current local backend port). Set
`CORE_PLATFORM_ALLOW_LOOPBACK_HTTP=true` for a locally hosted production website
build; this permits only loopback HTTP, not remote HTTP. Deployments on different
machines must use the approved HTTPS origin. Verify the backend `/facilities`
endpoint and the website `/api/marketplace/facilities` proxy both return HTTP 200
with the success envelope. An empty approved directory is not a service error.

All marketplace responses use `Cache-Control: no-store, private, max-age=0` and
`Pragma: no-cache`. Errors use `{ "status":"error", "message":"..." }`; success
responses use `{ "status":"success", "result": ... }`. No marketplace endpoint
accepts `tenantId` query input. Public and independent-staff requests reject a
body `tenantId`; core-staff routes reject it in both query and body. The
platform-super-admin link operation accepts a `tenantId` body value only as the
explicit target and independently verifies tenant standing, identity, and PLS
catalog configuration. Patient identifiers, contact information, payment references and
tracking credentials must not be placed in a URL.

## Corporate website enquiries

`POST /platform-enquiries` is the first-party receiver for the corporate
website's request-demo and contact forms. It requires the server-only bearer
token configured as `WEBSITE_LEAD_WEBHOOK_TOKEN`; missing or invalid
credentials are rejected before the payload reaches the service. The receiver
revalidates field lengths, email, source and submission time, then stores the
request in the control database `platform_enquiries` table with `new` status
and returns HTTP 202. Configure the website with the endpoint URL and the same
token through `LEAD_WEBHOOK_URL` and `LEAD_WEBHOOK_TOKEN`. Tokens and enquiry
contents are never written to request logs.

`GET /platform/enquiries?formType=all|demo|contact&page=1` lists stored enquiries
for an authenticated platform super-admin of the active control tenant, using
the same authority checks as facility management. The webhook bearer token does
not grant read access. The response is `{enquiries:[...],page,hasMore}` with up to
50 enquiries per page, ordered by received time and ID descending. Invalid
filters/pages and tenant query parameters are rejected.

In the main PLS application, **Manage facility > Website applications** displays
**Demo requests & contact enquiries** separately from laboratory registration
applications. Operators can filter demo/contact requests, refresh, paginate and
view all submitted contact, organization, interest and message details. Receiving
a demo request does not register, approve or provision a laboratory. Previously
stored enquiries appear without resubmission.

## Public discovery and registration

### `GET /facilities`

Optional `q` searches the public name, region, locality, and description. No
other query parameters are accepted. At most 200 approved facilities are
returned.

```json
{
  "status": "success",
  "result": {
    "facilities": [{
      "slug": "sample-lab",
      "name": "Sample Laboratory",
      "region": "Region",
      "locality": "Locality",
      "address": "Public facility address",
      "phone": "+000000000",
      "contactEmail": "contact@example.invalid",
      "description": "Public description",
      "openingHours": { "monday": "08:00-17:00" },
      "paymentInstructions": "Pay at the facility",
      "currency": "GHS",
      "facilityType": "independent"
    }]
  }
}
```

`facilityType` is `independent` or `pls-integrated`. PLS-linked facilities use
the live, published PLS catalog and do not expose a marketplace-owned price
override.

### `GET /facilities/:slug/catalog`

Returns `{facility,currency,tests,source}`. Each test has
`{id,type,name,description,price,sampleRequirements,collectionMethods,available,turnaroundHours}`.
For independent facilities, `source` is `marketplace`; linked facilities use
`pls-live`. The public PLS catalog does not publish marketplace home-collection
availability, so its marketplace collection method is in-facility only.

### `POST /registrations`

Creates an independent facility in `pending` state and creates its first,
facility-scoped administrator. Registration does not publish the facility or
enable login; platform approval is required.

```json
{
  "name": "Sample Laboratory",
  "slug": "sample-lab",
  "region": "Region",
  "locality": "Locality",
  "address": "Address",
  "phone": "+000000000",
  "contactEmail": "contact@example.invalid",
  "description": "Description",
  "openingHours": { "monday": "08:00-17:00" },
  "paymentInstructions": "Payment instructions",
  "currency": "GHS",
  "adminEmail": "owner@example.invalid",
  "adminPassword": "at-least-12-characters"
}
```

Administrator/staff passwords must be at least 12 characters and no more than
72 UTF-8 bytes (bcrypt's input limit). Returns HTTP `202` and
`{facility:{slug,status:"pending_approval"}}`. Passwords are bcrypt hashes;
the plaintext is never returned.

## Platform review, provisioning and publication

All platform operations require a verified platform super-admin session.
Marketplace routes derive tenancy from that session and reject query `tenantId`.

- `GET /platform/facilities?status=pending|approved|suspended` returns
  `{facilities:[...]}` with public application details, integration state,
  linked tenant ID and submission time; no password hashes or sessions.
- `POST /platform/facilities/:facilityId/approve` enables independent marketplace
  access without provisioning a PLS tenant.
- `POST /platform/facilities/:facilityId/provision` accepts the existing core
  provisioning payload plus `identityConfirmed:true`. Only an approved,
  unlinked application with no independent catalog or booking history is eligible.
  It returns `{facilityId,slug,integrationState,organizationIdentifier,tenantId,
  databaseName,adminUsername}`. A durable provisioning claim prevents concurrent
  duplicate tenants; linkage occurs in the final tenant activation transaction.
  Failures retain `provision_failed` for operator review, never automatic DDL retry.
- `POST /platform/facilities/:facilityId/retry-provisioning` accepts the same
  payload and is available only for an approved application in
  `provision_failed`. If the failed attempt reserved a tenant, the retry
  preserves its organization and tenant IDs, releases its cached connection,
  removes its partial database, rebuilds it, and links the application in the
  final activation transaction. If preflight failed before reservation, it
  safely starts a fresh provisioning attempt. Retry claims prevent concurrent
  attempts, and another failure remains visible as `provision_failed`.
- `POST /platform/facilities/:facilityId/link-tenant` remains the reviewed
  existing-tenant/catalog-mapping migration path.

The core platform routes `GET|PUT /api/v1/platform/facilities/:tenantId/public-profile`
manage an explicit public profile. They return `{status:"success",result:{profile}}`.
A profile includes `slug,name,region,locality,description,currency,published,
catalogPublished` and optional `website,facilityLoginUrl,patientPortalUrl,panelIds`.
Only active tenants may publish. Saved profiles override environment entries for
the same tenant, including unpublication; writes and audit entries are atomic.
Linked applications must share the profile slug and remain approved.

Public discovery merges approved independent marketplace records and explicitly
published active PLS profiles, without exposing tenant IDs or fabricating URLs.
PLS profiles without a marketplace integration return `bookingSupported:false`;
their live catalogs are browsable but do not offer online booking. Linked and
independent marketplace facilities retain the existing booking workflow.
`panelIds` explicitly classifies configured live test tariff IDs as panels;
unclassified configured tariffs remain tests, with no price overrides.

Remote portal destinations require clean HTTPS URLs. Same-machine development
may set backend `PUBLIC_FACILITY_ALLOW_LOOPBACK_HTTP=true` and website
`PLS_PORTAL_ALLOW_LOOPBACK_HTTP=true`, plus the exact host allowlist. This permits
only localhost/loopback HTTP and never credentials, queries or fragments.

## Patient booking and tracking

### `POST /bookings`

Request:

```json
{
  "facilitySlug": "sample-lab",
  "itemIds": [14, 15],
  "idempotencyKey": "43-character-base64url-256-bit-client-random-secret",
  "patient": { "name": "Patient Name", "phone": "+000000000", "email": "optional@example.invalid" },
  "collectionMethod": "in_facility",
  "collectionAddress": "Required only for home collection"
}
```

`itemIds` are unique selected catalog IDs (1–20). The client generates
`idempotencyKey` from 32 cryptographically random bytes (base64url, exactly
43 characters) before submission and retains it only as needed to safely retry
the request. It is also the opaque patient tracking bearer credential; the
server stores only its SHA-256 hash. An identical retry returns the original
booking ID/status/priced snapshot, while a different body using the same key is
rejected with `409`.

The service resolves prices
from the approved marketplace or live PLS catalog, validates the collection
method, calculates the total, and stores catalog/price snapshots transactionally.
The response is HTTP `201`:

```json
{
  "status": "success",
  "result": {
    "bookingId": "opaque-uuid-reference",
    "trackingToken": "same-secret-as-idempotencyKey",
    "status": "requested",
    "totalAmount": 100.00,
    "currency": "GHS",
    "paymentInstructions": "Payment instructions or null"
  }
}
```

`bookingId` is only a reference and grants no access. `trackingToken` equals the caller's idempotency key; only its SHA-256 hash is
stored. Do not put it in a URL, logs, analytics, or browser persistent storage.
A booking is a request, not an accepted
appointment, paid transaction, lab order, or completed service.

Retries use the exact original body and key. The caller-generated key is the
tracking bearer, so the client should keep it in memory during submission and
must not persist it across browser sessions.

### `POST /bookings/track`

Request `{ "trackingToken": "..." }`. Returns only booking ID, status,
payment status, amount/currency, collection method, scheduled time/instructions,
and item/price snapshots; no patient identity is returned. Missing/invalid
credentials never fall back to public lookup.

### `POST /bookings/payment-claims`

Patient tracking-token-authenticated payment claim:

```json
{ "trackingToken": "...", "reference": "external-reference", "amount": 100.00 }
```

Returns `{claimId,status:"pending_verification"}`. The reference is a claim, not
proof. Duplicate references are rejected globally. A separate authorized
facility staff decision must verify the exact catalog-priced booking amount;
submitting a reference never changes PLS billing or marks payment as paid.

## Independent-facility staff

### Login and session

`POST /staff/login` accepts `{facilitySlug,email,password}`. Approved facility
credentials are checked against bcrypt. On success the server sets
`pls-marketplace-session` with `HttpOnly; Secure; SameSite=Strict`, path
`/api/v1/marketplace/staff`, and 12-hour expiry. The response includes
`expiresAt`, `facility:{slug,name}`, and `staff:{id,email,role}`—the session
token is not returned in JSON. Browser clients must use
`credentials:"include"` and must not store credentials in localStorage.
Authenticated server-to-server callers may send an opaque session as
`Authorization: Bearer ...`.

`POST /staff/logout` revokes the current session and clears the cookie.
Sessions are stored as SHA-256 hashes, expire after 12 hours, and are scoped to
one facility. These credentials cannot authenticate a PLS tenant or another
marketplace facility.

### Routes

- `GET /staff/me`
- `GET /staff/users`, `POST /staff/users` (`{email,password}` creates a
  facility-scoped `staff` account), and `PATCH /staff/users/:staffId`
  (`{active:boolean}`); admin only.
- `GET /staff/bookings` (up to 200 most recent; patient data is staff-only)
- `GET /staff/catalog`
- `PATCH /staff/profile` (facility administrator only; editable public contact,
  description, hours, and payment instructions)
- `POST /staff/catalog`
- `PATCH /staff/catalog/:itemId`
- `POST /staff/bookings/:bookingId/payment-claims/:claimId/decision`
- `POST /staff/bookings/:bookingId/decision`
- `POST /staff/bookings/:bookingId/refunds`

Successful handlers wrap these service results in
`{status:"success",result:...}`:

- `GET /staff/bookings` returns
  `{bookings:[{bookingId,status,patient:{name,phone,email},collectionMethod,collectionAddress,branchId,scheduledAt,scheduleInstructions,totalAmount,currency,createdAt,paymentStatus,items:[{name,price,currency}],paymentClaims:[{id,reference?,amount,status,decisionReason,createdAt}]}]}`.
  `reference` is present only for admin/manager roles; other authorized booking
  viewers receive the remaining claim fields.
- `GET /staff/catalog` returns `{items:[{id,type,name,description,price,sampleRequirements,collectionMethods,available,turnaroundHours}]}` for independent facilities. For PLS-linked facilities it returns the public live-catalog shape `{facility,currency,tests,source:"pls-live"}`.
- `GET /staff/users` returns `{staff:[{id,email,role,active,createdAt}]}`.
  `POST /staff/users` returns `{staff:{id,email,role:"staff",active:true}}`;
  `PATCH /staff/users/:staffId` returns `{staffId,active}`.
- `PATCH /staff/profile` returns the updated public facility object:
  `{slug,name,region,locality,address,phone,contactEmail,description,openingHours,paymentInstructions,currency,facilityType}`.
- `POST /staff/catalog` and `PATCH /staff/catalog/:itemId` return
  `{id,type,name,description,price,sampleRequirements,collectionMethods,available,turnaroundHours}`.
- Payment decisions return `{claimId,status:"verified"|"rejected",decidedAt}`.
  Booking decisions return the private tracking view
  `{bookingId,status,paymentStatus,totalAmount,currency,collectionMethod,scheduledAt,scheduleInstructions,items:[{type,name,price,currency}]}`.
  Refund recording returns `{bookingId,paymentStatus:"refunded",refundId}`.

Login returns
`{expiresAt,facility:{slug,name},staff:{id,email,role}}`; `/staff/me`
returns `{staff:{id,email,role},facility:{id,slug,name,integrationState}}`;
logout returns `{revoked:true}`. The cookie is also cleared on logout.

Catalog writes accept
`{type:"test"|"panel",name,description,price,sampleRequirements:string[],collectionMethods:["in_facility"|"home"],available?,turnaroundHours?}`.
`turnaroundHours` is a positive integer when supplied. PLS-linked catalog is
read-only. Catalog creation/price changes and actor/time are recorded in
`marketplace_catalog_price_history`; booking-time names and prices remain
separately snapshotted.

Payment decision accepts `{decision:"verified"|"rejected",reason}`. Booking
decision accepts `{action,reason}` where action is `accept`, `reject`,
`schedule`, `collect`, `process`, `complete`, or `cancel`. Valid forward states
are:

```text
requested -> accepted -> scheduled -> collected -> processing -> completed
requested/accepted -> rejected
requested/accepted/scheduled -> cancelled
```

Scheduling and fulfillment require manually verified payment. A verified
booking cannot be rejected; it must be cancelled and explicitly refunded.
Cancellation after collection is not allowed. Payment states are derived from
claim/refund records: `unpaid`, `pending_verification`, `verified`, `rejected`,
`refund_pending`, `refunded`. A refund records a staff-confirmed external
reference, amount, actor, and time; it does not execute a money transfer.

The `schedule` action body is
`{action:"schedule",reason,scheduledAt:"2030-01-01T10:00:00Z",scheduleInstructions?}`.
It requires a timezone-qualified future `scheduledAt`,
optional `scheduleInstructions`, and (on core PLS routes only) a `branchId`
that exists in the linked tenant. Marketplace-only facilities must not send a
PLS branch ID. The tracking response returns scheduled time and instructions.
Only administrators may edit catalogs/profiles, manage users, verify payment,
or record refunds; ordinary facility staff may view bookings/catalog and
perform allowed booking transitions.

## Integrated PLS staff and explicit linkage

Integrated-facility routes use the existing `pls-prime-tenant-session`
cookie/header, live PLS role lookup, session validation, and linked tenant
boundary. Caller-supplied tenant IDs are rejected. Platform approval/linking
uses the existing `requirePlatformFacilityAuthority` middleware.

- `GET /core/facilities/:slug/bookings`
- `GET /core/facilities/:slug/catalog`
- `POST /core/facilities/:slug/bookings/:bookingId/payment-claims/:claimId/decision`
- `POST /core/facilities/:slug/bookings/:bookingId/decision`
- `POST /core/facilities/:slug/bookings/:bookingId/refunds`
- `POST /core/facilities/:slug/bookings/:bookingId/core-link`

The last route explicitly links a scheduled, manually paid-verified
booking to existing PLS records using
`{patientId,billingId,sampleId?}`. It validates the patient, that the billing
belongs to that patient, the billing branch, all selected mapped tests in
`test_ascension`, and (when supplied) that the sample matches the same patient
and billing. It records an auditable, idempotent link; it creates no patient,
billing, sample, order, or payment and does not alter core billing/payment
state.

### Facility approval and gradual integration

- `GET /platform/facilities?status=pending|approved|suspended` — defaults to
  pending; authorized platform review queue returns facility IDs and public
  registration details (never administrator password hashes).
- `POST /platform/facilities/:facilityId/approve` — existing platform
  super-admin authority.
- `POST /platform/facilities/:facilityId/suspend`, body
  `{reason}` — suspends an approved facility and prevents public listing and
  staff login; existing bookings remain auditable.
- `POST /platform/facilities/:facilityId/link-tenant` — same authority; body:

```json
{
  "tenantId": 12,
  "identityConfirmed": true,
  "catalogMappings": [
    { "marketplaceItemId": 3, "coreItemId": 27, "coreItemType": "test" }
  ]
}
```

The tenant must be active and a matching published PLS catalog with the same
public slug must already exist. Every marketplace catalog item—including
retired items referenced by history—must be explicitly mapped to a published
PLS test. No fuzzy/name matching occurs. Linking retains the facility public
identity, marketplace catalog and historical price/payment/booking snapshots;
historical item IDs gain explicit core mappings, after which public catalog
and new bookings use live PLS data.
