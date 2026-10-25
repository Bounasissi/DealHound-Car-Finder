# KBB integration

DealHound's default qualified lane means **asking price <= 70% of a KBB Good-condition private-party reference**. A comparable-market estimate or MarketCheck predicted price is useful for discovery, but it is not a KBB reference and cannot qualify that lane unless a profile explicitly enables exploratory mode.

## Current boundary

Kelley Blue Book currently offers InfoDriver Web Service (IDWS), a commercial REST service for integrating KBB values into software. KBB describes IDWS as providing VIN decoding and used-vehicle values including private-party value/range, with values updated weekly. The public product page directs software developers to contact KBB for the developer portal and contract-specific documentation:

- [KBB InfoDriver Web Service](https://b2b.kbb.com/industry-solutions/info-driver-web-service-idws/)
- [KBB vehicle-value methodology](https://b2b.kbb.com/kbb-vehicle-values/)

The repository does not scrape KBB.com and does not guess undocumented InfoDriver fields. Until a KBB contract and developer documentation are available, users enter the KBB Good value manually during ingestion or on the listing detail page.

## Licensed adapter contract

The application has a provider boundary for a vendor-approved KBB bridge. Configure:

```text
VALUATION_PROVIDER_URL=https://your-approved-bridge.example
VALUATION_PROVIDER_API_KEY=...
```

When configured, DealHound sends `POST ${VALUATION_PROVIDER_URL}/valuations` with a JSON body containing the normalized vehicle, mileage, and asking price. The bridge must call the licensed KBB service under its own contract and return a validated JSON response:

```json
{
  "provider": "kbb-infodriver",
  "referenceGoodValue": 15200,
  "confidence": 0.95,
  "notes": "KBB Good private-party value for the requested ZIP and vehicle configuration"
}
```

`referenceGoodValue` must be a positive number. The application records configured licensed-provider results as `KBB_GOOD`; it does not convert MarketCheck or comparable values into KBB values. The bridge owner is responsible for supplying the vehicle configuration, ZIP/region, mileage, condition, options, and any disclosures required by the KBB contract.

## Go-live checklist

1. Obtain KBB InfoDriver approval, credentials, display/use rights, and the current developer documentation.
2. Implement the bridge against that documented contract; do not point the app directly at an undocumented KBB endpoint.
3. Verify a known VIN in the bridge and compare the returned Good-condition private-party value with the approved KBB response.
4. Configure `VALUATION_PROVIDER_URL` and `VALUATION_PROVIDER_API_KEY` as deployment secrets.
5. Confirm `/profiles` shows the licensed KBB adapter as ready, then run the authenticated ingest/evaluate smoke test.
6. Keep the profile's **Require KBB Good benchmark** setting enabled for the production deal lane.

Without these gates, manual KBB entry is the authoritative path and the app must continue to label proxy/comparable results as exploratory.
