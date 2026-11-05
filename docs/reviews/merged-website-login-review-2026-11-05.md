# Merged website and client-login review — 5 November 2026

## Confirmed weaknesses and corrections

1. Returning signed-in staff could land on the new public homepage, while fresh login used a different role map. Fresh login, returning-login redirects and role switching now use shared destination rules. Cashiers, scientists, CRM, accounting, imaging and pharmacy roles reach their authorized task pages. Managers reach CRM. In a pharmacy-only facility, a general manager is directed to assigned roles rather than a pharmacy page that the existing policy forbids. No role grants were added.
2. Pharmacy cashier, storekeeper, accountant and dispensary destinations differed between login paths. These now resolve consistently, including the dispensary prescription page. Staff aliases normalize consistently. Unknown roles do not fall through to the public homepage.
3. Client Login disappeared at mobile and intermediate desktop breakpoints. It now remains visible; the demo action gives way at narrower desktop sizes. Mobile menu opening and Escape dismissal were verified.
4. The facility-entry screen repeated headings, offered competing login paths and did not explain an already signed-in browser. It now has one primary staff/practitioner action, a separate patient link, clear full-username guidance, and explicit instructions to save work and sign out before changing facility/account. Optional external installation links are in a disclosure and show the selected destination host before navigation.
5. Direct login waited on optional public directory data. The optional listing now streams under Suspense. A test holds the directory promise indefinitely and confirms the sign-in shell still renders. An unavailable or empty directory does not prevent full-username login.
6. CSS scoping had mistakenly rewritten class names containing the word body, breaking dashboard and software illustrations. The affected selectors are repaired and a parsed-selector regression verifies every website rule stays within the public wrapper. Sign-in instruction list styles were also isolated to prevent inherited badge styles from squeezing text into narrow columns.
7. Login lacked a clear route back to the website, called all staff Center Login and did not explain wrong account types. It now includes website/login-options links, Staff Login wording that covers laboratory/imaging/pharmacy teams, correct account-type guidance before sending a request, and password clearing when changing staff/practitioner forms. Its font uses the application theme variable.

## Verification

- Full frontend suite: 1,127 tests passed. Three additional regressions then passed, covering nonblocking directory loading, explicit selected-destination navigation and destination/role-policy agreement.
- Production build with strict TypeScript completed successfully using a separate build-output directory.
- Backend targeted suite: 42 tests passed across tenant resolution, username/session validation, role recovery lifetime, session revocation and role-assignment access.
- Returning-session matrix: 27 roles across two isolated facility contexts, tenant-bound backend URL/headers, pharmacy-only configuration and backend rejection/outage cases.
- Fresh login: two isolated facility contexts, canonical role destinations, cookie/context tenant agreement, pharmacy-only configuration, timeouts, blocked storage and safe return URLs.
- Cookie handler: real JWT signing/verification against fixture backend responses; submitted role claims cannot override backend identity; a token for either test facility cannot mint a cookie for the other; unsupported roles are rejected; HttpOnly/Secure/SameSite settings remain intact.
- Actual browser: existing GMS Super Admin login continuation and assigned-role list reviewed without adding assignments. Isolated production browser verified password toggle, wrong practitioner-in-staff-form guidance, password clearing when changing mode, back-to-options navigation, a fresh CSP-protected website-to-login transition, separate patient-login routing, directory-unavailable fallback and mobile menu Escape handling. Client Login remained visible and no horizontal overflow was measured at 390px and 1280px.

## Scope and remaining acceptance limits

The current live account has only Super Admin assigned. Other facilities and roles were tested with isolated automated fixtures, not by using their real passwords or altering permissions. No real credentials, role assignments, tenant records or clinical/financial workflows were changed. Live credential-based acceptance for other facilities requires existing authorized test accounts.

The development server intentionally rejects scripts requested from the alternate loopback origin. Its protection was retained; anonymous UI testing used the verified production build temporarily on loopback port 2379 instead. The normal application continues at port 2377. Public directory integration still needs the deployment's normal public-catalogue backend configuration; direct login does not depend on it.

The public domain has not been deployed by this review.


## Real-account follow-up — 5 November 2026

The user supplied authenticated browser sessions; no passwords were read, changed or reset by the assistant.

- GMS / TIIFU HAMZA / Super Admin: website Client Access -> Continue to sign in reached /settings/facilities; assigned roles showed only Super Admin. Adding a different tenantId to /account/roles retained GMS and its assignments. This verifies the URL override did not switch the active facility; it is not a substitute for a second-facility credential test.
- After the user reported signing in as Scientist, the actual browser showed GMS / TIIFU HAMZA / Scientist at /operations/laboratory with laboratory navigation.
- Scientist requests to /settings/facilities and /billing/cash-collection redirected to /unauthorized. No platform or cashier content was exposed in those checks.
- Confirmed merge-related usability defect: the denied-page Return to Home action pointed at the public homepage. It now says Return to your workspace and uses the existing authenticated login resolver. The header uses the correct product name; the misleading 401 label is replaced with Access restricted. No authorization policy was changed.
- Clicking the corrected action navigated to /operations/laboratory. The workspace then reported that another-device sign-in had replaced the session. Continued authenticated acceptance is therefore not marked passed after that point. The normal session rejection remains intact.
- The current session was in GMS for both observed roles. A credential-based sign-in to a second facility is still required. Cashier, accountant, pharmacy and other live-role account tests remain pending. The assistant did not create accounts, grant roles or replace these checks with fixtures.

The access-denied page syntax check passed. These are browser observations, not claims that every login or tenant-isolation scenario has been verified.
