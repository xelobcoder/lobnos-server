# Consultation implementation status — 25 October 2026

## Delivered in source

- Dedicated doctor workspace at `/doctor` with authorized patient search, pending work, resumable drafts, in-page notes/vitals/referrals/prescriptions/history, responsive navigation and readable application typography/colors.
- Explicit start/save/sign/amend lifecycle. Opening a patient does not create a record. Failed or conflicting saves retain text, and navigation protects unsaved notes and orders.
- Backend identity comes from the verified session. Staff and external practitioner IDs are distinguished. Enabled profiles, patient grants/live referrals, branch scope and separate consultation/lab/prescribing capabilities govern access. Legacy consultation and vital endpoints use the same policy.
- Credential creation no longer overwrites every practitioner's password. New initial credentials use bcrypt. Disabled profiles cannot log in or continue using clinical endpoints.
- `/doctor/access` supports manager/admin configuration, existing staff-login links, patient assignment and one-time invitations. Link delivery works without an external provider; email/SMS use the existing configured patient-portal delivery infrastructure. Activation permits the practitioner to choose their password without an existing login. No real invitations were sent during development.
- Vital signs retain SpO2 including zero, identify missing values without claiming normality, require reasons for incomplete observations, derive the observer from the session, preserve original observation time on correction and audit corrections. Legacy DECIMAL precision and DATETIME observations are explicitly handled by the schema upgrade.
- Clinical requests carry durable idempotency keys so retrying after a lost response does not create duplicate referrals or prescriptions. Released results remain behind the approved release policy.

## Deployment and setup

Deploy frontend and backend together. The guarded migration is `20261025_practitioner_consultation`; startup also checks the schema. Back up the facility database before deployment. Practitioners must be configured explicitly under `/doctor/access`; internal clinicians link an active staff login, while external clinicians activate an invitation. Do not enable all old accounts automatically.

Previously overwritten passwords cannot be reconstructed safely; invite affected practitioners to choose a new password. Historical records with ambiguous staff/external numeric author IDs remain historical until a manager reconciles ownership with supporting evidence.

## Verification and remaining work

- 196 affected backend tests passed in 17 files.
- 22 isolated MySQL checks passed against a fresh temporary database, including the authoritative legacy vital schema (DECIMAL temperature, DATETIME date and no time column), preserving a synthetic 36.8 temperature and observation time, and repairing a previously zero-scale decimal column to accept an exact 36.85 observation.
- 14 desktop/mobile browser checks passed against real rebuilt frontend components with synthetic API fixtures, including the new sidebar/header and mobile drawer. No production patient data or provider delivery was used.
- The final backend TypeScript build passed. Frontend whole-application type checking still has six existing route/component diagnostics outside the changed consultation/billing/sampling files; full frontend production build readiness is not claimed.
- The broader backend suite has unrelated date-fixture, result-database mock and facility-role expectation failures. Standalone provisioning additionally lists three existing migrations absent from its reviewed allowlist (`20261024_pharmacy_enterprise_workflows`, `20261024_pharmacy_price_types`, `20261025_billing_layout`); the new consultation migration itself is listed. These were not silently marked reviewed.

### Local temperature precision incident — recovered and verified

An intermediate version of my schema change omitted DECIMAL precision while making vital columns nullable. The running local development backend applied it, changing temperature from DECIMAL(6,2) to DECIMAL(10,0), rounding one local observation. The corrected migration preserves full SQL column types and restores at least two temperature decimal places without shrinking the previous integer range.

Recovery completed on 25 October 2026. All 49 retained local binary logs were scanned read-only. Coverage begins 25 September, before the verified successful 8 October backup, and contains no vital-sign changes before the faulty migration. The backup's database header and the observation's ID, patient reference, date/time, blood pressure, pulse, respiration, observer and SpO2 all matched. Its SHA-256 is `385f0820e4c22b36fa3732f4c20246a9b650ce43922cd1c6f785a9e691b4307c`.

The original fractional temperature was restored from that backup, not guessed. The local column is now DECIMAL(12,2). Recovery took a pre-repair snapshot, locked and rechecked the observation, updated only its temperature and concurrency revision, and inserted a system `migration_precision_recovered` audit with backup provenance. Original observation and correction timestamps, observer and other readings were preserved. A subsequent read-only comparison after the corrected backend build found no temperature difference from the verified backup. No patient identifiers or full clinical rows were printed; the local recovery snapshot is excluded from Git.

Read-only evidence tooling is in `scripts/recover-local-vital-temperature.cjs` and `scripts/inspect-vital-backup.cjs`. Recovery was limited to the affected local database. No production database was changed. Do not deploy the intermediate migration.

## Doctor portal layout preview

`components/Practitioner/DoctorShell.tsx` now follows the patient portal's layout pattern: slate sidebar, Prime green active navigation, branded identity, separate clinical/account link groups and a white header with current page, practitioner identity and access status. Mobile navigation uses a drawer with a backdrop, keyboard focus containment, Escape close/focus return and scroll restoration. Capability-driven links and unsaved-clinical-work protection remain enforced. Inner consultation, vital-sign and prescription pages were not redesigned in this layout change. The application font remains inherited. Desktop and mobile screenshots were visually inspected; the browser harness now isolates CSS module names accurately so unrelated component styles cannot mask layout defects in previews.
