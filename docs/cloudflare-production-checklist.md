# Prime Laboratory production behind Cloudflare

Deploy the frontend and backend changes together. No database migration is required for these payment/cache fixes.

## Observed publicly on 25 October 2026

- Anonymous `/crm/registration` redirected to `/authentications/login` (307). This is expected authentication behavior.
- `/authentications/login` returned 200 with `CF-Cache-Status: DYNAMIC`, but `Cache-Control: s-maxage=31536000`. The patch makes login rendering dynamic and marks protected-page responses/redirects and APIs private/no-store.
- These anonymous checks do not establish why an authenticated production request fails. Production environment variables, origin logs and Cloudflare configuration have not been inspected.

## Cloudflare configuration

1. In the domain dashboard, open **Caching → Cache Rules**. Disable any broad **Cache Everything / Eligible for cache** rule covering application pages or APIs.
2. Add a **Bypass cache** rule for:

   ```text
   (http.host eq "app.primelabsys.com" and not starts_with(http.request.uri.path, "/_next/static/"))
   ```

   Ensure no later matching rule overrides this bypass. Keep immutable `/_next/static/` assets cacheable. If the backend has its own proxied hostname, bypass caching for that hostname's API paths too.
3. Preserve query strings (including `_rsc`) and the `RSC`, `Next-Router-*`, `Cookie` and `Vary` headers. Do not merge HTML and RSC responses into one cache key.
4. After the rule changes, purge previously cached application/login/API URLs. If only zone-wide purge is available, it also clears static caches, which will refill.
5. Use **SSL/TLS → Full (strict)** after verifying a valid origin certificate. Flexible mode can cause redirect loops when the origin redirects HTTP to HTTPS. Do not change SSL mode without checking the origin certificate.

## Server-to-backend connection

The browser uses the frontend's same-origin `/api/v1/` proxy. On the frontend server, `PRODUCTION_BASEURL` must point to the actual backend, with a trailing `/api/v1/`:

```text
PRODUCTION_BASEURL=http://127.0.0.1:2300/api/v1/
```

This example applies only when both services run on the same host/network namespace. For separate servers or containers use the reachable private service address instead. Rebuild/restart the frontend after changing this variable because Next.js configuration also exposes its build-time value.

Do not point the frontend proxy back at `app.primelabsys.com/api/v1/`; that causes a proxy loop. Do not send port 2300 through ordinary Cloudflare orange-cloud proxying: it is not a supported HTTP proxy port. Use private origin networking, an HTTPS reverse proxy on 443, or a properly configured Tunnel.

If `PLS_BACKEND_ACCESS_TOKEN` is configured for the existing backend gateway, configure the frontend server's matching token. It stays server-side; the login validation request now uses the same authorization helper as other backend proxy requests.

## Verify after deployment

- From the frontend host, request the backend's `/api/v1/health`. It should return `healthy`; connection failures here indicate origin networking/service configuration.
- Signed-out registration should redirect to login once. Login should load successfully, with private/no-store caching and no cached authenticated redirect.
- Sign in and check `/api/auth/context-retrieval` and a normal `/api/v1/` request. They should return API JSON, not Cloudflare challenge HTML or a login redirect.
- Check Cloudflare Security Events for blocked/challenged API requests if JSON requests fail. Apply a narrowly scoped exception for the verified false positive rather than disabling protection for the entire site.
- Test a partial payment, a free bill, and staff FOC in a test tenant. Staff benefit coverage must not appear as cash received. A benefit requiring approval must remain outstanding until approved.

Never include cookies, authorization headers or patient/billing payloads in shared diagnostics.

References: [Cloudflare login/cache troubleshooting](https://developers.cloudflare.com/cache/troubleshooting/dynamic-content-and-login-issues/), [supported proxy ports](https://developers.cloudflare.com/fundamentals/reference/network-ports/), [Next.js CDN requirements](https://nextjs.org/docs/app/guides/cdn-caching), [Cloudflare redirect loops](https://developers.cloudflare.com/ssl/troubleshooting/too-many-redirects/).
