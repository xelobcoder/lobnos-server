
┌────────────────────────────────────────────────────────────┐
│                 START BILLING STRATEGY CHECK               │
└────────────────────────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Identify Client Entity    │
            │ (organization, insurance,  │
            │ clinician, or general)     │
            └────────────────────────────┘
                         │
                         ▼
      ┌────────────────────────────────────────┐
      │   Fetch All Active Strategies Matching │
      │      Entity + Track ID (if any)        │
      │ applies_from <= NOW <= applies_to      │
      └────────────────────────────────────────┘
                         │
                         ▼
       ┌────────────────────────────────────┐
       │     Filter by Time-Based Conditions│
       │  (condition_type = 'time_of_day')  │
       └────────────────────────────────────┘
                         │
                         ▼
       ┌────────────────────────────────────┐
       │    Filter by Day-of-Week, Custom   │
       │  (e.g., weekends, holidays, etc.)  │
       └────────────────────────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  Match Strategy Price Entry for  │
        │     test_panel_id or testid      │
        └──────────────────────────────────┘
                         │
                         ▼
       ┌─────────────────────────────────────┐
       │ Apply Strategy:                     │
       │  - Flat: price = base - amount      │
       │  - %:   price = base * (1 - amount) │
       └─────────────────────────────────────┘
                         │
                         ▼
         ┌────────────────────────────┐
         │     Return Final Price     │
         └────────────────────────────┘



         ┌────────────────────────────────────────────────────────────┐
│                 START BILLING STRATEGY CHECK               │
└────────────────────────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Identify Client Entity    │
            │ (organization, insurance,  │
            │ clinician, or general)     │
            └────────────────────────────┘
                         │
                         ▼
      ┌────────────────────────────────────────────────┐
      │   Fetch All Active Strategies from             │
      │   `prime_billing_strategy_assignments`         │
      │   WHERE entity_type = ?                        │
      │     AND (track_id = ? OR track_id IS NULL)     │
      │     AND applies_from <= NOW <= applies_to      │
      └────────────────────────────────────────────────┘
                         │
                         ▼
       ┌────────────────────────────────────────────┐
       │  For each strategy, fetch time-based       │
       │  conditions from `prime_billing_strategy_  │
       │  conditions`                                │
       │  → Filter:                                  │
       │     - Time of day matches                   │
       │     - Day of week matches                   │
       │     - Custom/date range (if applicable)     │
       └────────────────────────────────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────────────┐
        │  Find applicable price entry in          │
        │  `prime_billing_strategy_prices`         │
        │  WHERE billing_strategy_id = ? AND       │
        │    (test_panel_id = ? OR test_panel_id IS NULL)│
        └──────────────────────────────────────────┘
                         │
                         ▼
       ┌──────────────────────────────────────────────┐
       │ Apply Price Adjustment:                       │
       │   IF price_type = 'flat':                     │
       │     final_price = base_price - amount         │
       │   IF price_type = 'percentage':               │
       │     final_price = base_price * (1 - amount)   │
       └──────────────────────────────────────────────┘
                         │
                         ▼
         ┌────────────────────────────────────┐
         │ Record in `prime_billing_audit`:   │
         │  - base_price, final_price         │
         │  - strategy_id, price_id, etc.     │
         └────────────────────────────────────┘
                         │
                         ▼
         ┌────────────────────────────┐
         │     Return Final Price     │
         └────────────────────────────┘
