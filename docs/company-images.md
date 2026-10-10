# Company profile images

`GET /api/v1/settings/companyprofile/images?tenantId=<positive integer>` remains
a public binary image endpoint, subject to the existing tenancy agreement check.
A missing image returns the existing 404 response. Reads do not create directories.
Responses use the image MIME type and `Cache-Control: no-store`.

`POST` at the same URL accepts the existing multipart `file` field, JPEG or PNG,
up to 5 MiB. It now requires a valid staff session for that tenant and the live
`admin` or `super-admin` role. The frontend uses its existing authenticated
`customFile` helper. Invalid/failed uploads do not remove the current image.

New images are written under
`dist/asserts/company/tenants/<effectiveTenantId>/logo`. Temporary uploads stay
within that tenant directory and a successful upload atomically replaces `logo`.
No upload deletes another tenant's image or the old shared image.

## Legacy compatibility

The former shared JPEG/PNG/GIF directly under `dist/asserts/company` is available
**only** to `configuration.defaultTenantId`, the tenant registered for this
installation's original database. A tenant-specific logo takes precedence.
Other facilities without their own image receive 404; they never inherit the
shared image. Confirm that `DEFAULT_TENANT_ID` still identifies the legacy owner
before deploying to an installation with an old shared logo. Do not change it
to a newly provisioned facility to make its image appear.

Single-tenant installations retain the existing effective-tenant alias behavior
and may omit the query. Multi-tenant image requests must specify a tenant.
No schema migration or automatic file/data migration is required.

Backend report `logourl` values now include `tenantId`. Frontend report headers
discard unscoped legacy URLs instead of fetching an installation-wide logo.
Receipt/profile/payroll clients resolve the tenant using the existing verified
session context, never a hardcoded/default tenant. Optional report street lines
come from the same tenant company profile as the required address.
