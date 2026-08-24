# Valuations

Use comparable-market values, manual KBB/J.D. Power/private-party entries, or an explicitly configured licensed adapter. Every saved valuation records its provider and provenance note.

An optional `MARKETCHECK_PRICE_ENABLED=true` lane can automatically value VIN-bearing listings through MarketCheck's predicted market-price endpoint. This is a market proxy, not KBB Good; configure `MARKETCHECK_PRICE_ZIP` when listings do not include a ZIP and confirm the result against KBB before purchase. Manual KBB remains the authoritative benchmark for the product's ≤70% KBB filter.

KBB-specific licensed access is not assumed. Until it exists, use a manual Good-condition value plus comparables and document the source.

Search profiles require a `KBB_GOOD` reference by default. Comparable and MarketCheck values remain visible for exploration, but they are marked not KBB-qualified and cannot qualify the default deal lane or create alerts unless the profile explicitly disables the KBB requirement.
