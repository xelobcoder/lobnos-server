# Application typography and modern payment retries — 26 October 2026

## Findings and changes

Slack and portal workspace CSS redeclared `--theme-font-family` below the root, ribbon did the same, and the general workspace shell hardcoded Inter. Those declarations hid the selected application family. Layouts now inherit the application font. The portal font resolver honors an explicit saved family before choosing a layout fallback. Legacy font stacks are normalized by their first family.

PrimeLayout reapplied an old browser preference on mount, and ThemeProvider reapplied it whenever the color theme changed. Removed the duplicate layout initialization; theme changes only apply a fallback if no document preference is present. Application settings synchronize the cached choice and Bootstrap font variable. Font caching is guarded when browser storage is unavailable.

Reduced unusually heavy workspace branding/navigation and modern billing weights to medium/semibold while retaining regular body text and existing font sizes. No page layout was replaced. Future section design should follow the section's tasks rather than automatically copy critical-values styling.

Modern payment previously committed tentative payment allocations to shared billing state before submission succeeded, then appended those allocations on retry. Modern submissions now pass an isolated payload to the existing submission callback without committing tentative context values. Full and partial allocations replace the current draft allocation rather than append it. Failures preserve the form with inline retry feedback; a submission lock prevents repeated clicks and finally clears busy state. Modern full-payment comparisons use cents. Compact payment behavior and backend validation/authorization remain unchanged. Existing selected modes remain available when reopening a modern draft.

## Verification

- 34 modern billing browser checks passed, including new failed-full/failed-partial retry cases that assert shared state is unchanged and the successful payload contains exactly one allocation. Existing FOC, NHIS, unpaid, receipt, outsourcing, keyboard and mobile checks remain covered.
- Six typography browser checks use the real application/theme providers and layout styles to verify computed families on Slack/portal/ribbon body text, inputs, tables, buttons and modal text, color-theme stability, saved-family resolution, regular/medium weights and blocked-storage handling. Fixtures use system font aliases; these checks do not download or validate Google font binaries.
- 55 frontend billing/submission/suspension unit tests passed. An outdated NHIS test expected numeric identifiers; assertions now match the established string contract. No NHIS application behavior changed.
- Final full frontend type check (`tsc --noEmit --incremental false`) passed with zero errors.

All billing browser writes used synthetic data. No real payment or patient transaction was submitted. Backend endpoints, accounting rules and authorization were not modified.
