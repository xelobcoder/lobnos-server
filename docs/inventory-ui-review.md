# Inventory UI consistency pass

The inventory workspace now shares application font and theme tokens, modest heading weights, consistent controls, tables and dialog surfaces. Templates no longer use a separate blue mobile theme; usage analytics uses theme-aware page backgrounds. Stock entry becomes labeled two-column fields on phones. Supplier/location/category details wrap instead of being silently truncated.

Category and template loading failures have retry controls; templates distinguish loading, empty and unmatched-search states. Supplier/template validation feedback uses existing toast infrastructure. The unused Apply Template placeholder handler was removed; no new template application workflow was invented.

Existing dialog handlers gain focus containment, Escape close and focus restoration. No permission checks, API payloads, stock calculations, approval or payment workflows were changed.

Verification: full frontend type check; isolated browser checks of nine actual page components (items, categories, suppliers, templates, locations, units, wastage, consumption, payments) at 1280px and 390px. Actual PrimeTable renders with populated category/supplier fixtures. Checks cover category editor, supplier edit, category load failure/retry and pharmacy stock entry on mobile. All API writes are intercepted. Screenshots inspected for templates and pharmacy stock entry. This is not production end-to-end coverage of all 39 routes or live stock/payment submission.
