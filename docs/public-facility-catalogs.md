# Public laboratory directory and catalogs

The corporate website at the configured `primelabsys` domain uses a narrow,
read-only API. It never calls the private tenant directory, accepts staff/patient
credentials, or retrieves patient data.

- `GET /api/v1/public/facilities` returns `{ facilities: [...] }`.
- `GET /api/v1/public/facilities/:slug/catalog` returns `{ facility, tests,
  services, currency, pricingContext, updatedAt }`.
- A catalog item is `{ id, name, description, price, currency }`. A missing
  description is `null`; it must not be invented by the website.

## Explicit publication

Configure `PUBLIC_FACILITY_DIRECTORY_JSON` server-side with an array of approved
public listings. No listings are published by default. Example structure
(replace every example with approved facility information before publishing):

```json
[
  {
    "slug": "approved-laboratory",
    "tenantId": 3,
    "name": "Approved public laboratory name",
    "region": "Approved region",
    "locality": "Approved locality",
    "description": "Approved public description",
    "currency": "GHS",
    "published": false,
    "catalogPublished": false,
    "website": "https://lab.example",
    "facilityLoginUrl": "https://lab.example/authentications/login",
    "patientPortalUrl": "https://lab.example/patientportal"
  }
]
```

Set `published: true` only with permission to publish the facility details.
Set `catalogPublished: true` only with permission to publish **all configured
test names/descriptions and general cash tariffs, plus additional-service names
and list prices**. This opt-in is deliberately separate from facility discovery.
Review description content before approval; this endpoint treats it as public
text, never as executable HTML. Descriptions are drawn from `test_panels.description`,
not internal procedure manuals, literature, or patient records. Additional-service
descriptions are absent in the current schema and returned as `null`.

Only active registered tenants are listed. Single-tenant installations must
configure only their actual default tenant ID. Slugs resolve server-side to
approved tenant connections; tenant IDs and internal fields are not returned.
No caller-supplied tenant or payer parameters are accepted. Destinations must be
credential-free HTTPS URLs without query parameters, and only approved URLs in
this operator-controlled registry are public.

## Price meaning and freshness

The API uses `test_panels.price` for tests with a `testdetails` configuration,
the same base tariff used by general/cash billing. Additional services use
`additionalservices.servicePrice`. It does not initialize a transaction, require
an active cashier session, apply a private payer concession, create a bill,
collect payment, or expose stock costs/staff details.

Final prices can differ for packages, insurance/NHIS, concessions, promotion,
taxes and other billing rules. Always display `pricingContext`. Website visitors
must confirm preparation requirements and the final price with the facility.
Read responses are `no-store`, so approved tariff edits appear on subsequent
requests. Invalid records or database/configuration errors return a generic
503 with server-standard logging, not an empty success response.

## Website connection and deployment

Set the website's server-only core-platform URL to the approved backend origin.
Use HTTPS in production, verify the origin allowlist and URL validation in the
website, and use its server-side integration so browsers never query private
tenant endpoints. Set the website canonical URL to the approved `primelabsys`
domain; no DNS or production routes are changed by this implementation.

Apply deployment-level rate limiting to `/api/v1/public/facilities` and its catalog
subpaths (for example the Nginx `limit_req` configuration below), alongside normal
backend protection. This keeps the API stateless across multiple application
workers and avoids trusting spoofable forwarding headers in application memory.

```nginx
# http context
limit_req_zone $binary_remote_addr zone=public_catalog:10m rate=5r/s;

# Existing backend virtual host; adapt upstream, do not replace unrelated routes.
location /api/v1/public/facilities {
    limit_req zone=public_catalog burst=20 nodelay;
    proxy_pass http://existing_backend_upstream;
}
```

Do not enable real public listings without approval or alter production DNS,
existing authentication or tenant administration routes to serve this website.
