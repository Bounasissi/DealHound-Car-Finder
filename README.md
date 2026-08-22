# DealHound Car Finder
DealHound-Car-Finder: 082226

DealHound Car Finder: Software to find cars on Facebook marketplace way under KBB where I can apply filters - I want clean title cars that need work for like 70% or less kbb in good condition. 


---


# E2E Implementation Plan — “DealHound” Car Finder

## 1. Product objective

Build software that identifies **private-party vehicles priced materially below their true market value**, prioritizing:

* **Clean-title vehicles**
* **Asking price ≤70% of KBB Good-condition value**
* Vehicles that **need repair/reconditioning**, rather than already-retail-ready cars
* Repairs where the economics still work after parts/labor
* User-configurable make/model/year/mileage/location/repair constraints
* Immediate alerts when a high-quality opportunity appears
* A transparent explanation of **why the vehicle is or is not a good deal**

The core rule should **not** simply be:

> Price ≤ 70% of KBB

It should ultimately be:

```text
ASKING PRICE <= 70% × REFERENCE VALUE

AND

ALL-IN ACQUISITION COST
    = purchase price
    + repairs
    + inspection
    + transportation
    + transaction/title costs
    + risk reserve

<= configured % of CONSERVATIVE POST-REPAIR VALUE
```

That second test is what prevents a $6,000 “deal” on a $10,000 vehicle from looking attractive when it needs $4,500 of work.

---

# 2. Recommended product architecture

```text
                    ┌─────────────────────────┐
                    │     SEARCH PROFILES     │
                    │ location / price / age  │
                    │ mileage / makes / etc.  │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     DISCOVERY LAYER                         │
│                                                             │
│ Facebook Marketplace          Authorized/API Sources        │
│ user-assisted initially       MarketCheck / others          │
└───────────────┬────────────────────────┬────────────────────┘
                │                        │
                ▼                        ▼
        ┌──────────────────────────────────┐
        │      LISTING NORMALIZATION       │
        │ year / make / model / trim       │
        │ VIN / mileage / price / location │
        │ description / photos / seller    │
        └──────────────────┬───────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │         ENRICHMENT ENGINE        │
        ├──────────────────────────────────┤
        │ VIN decode                       │
        │ KBB / market valuation           │
        │ Comparable listings              │
        │ Title/history check              │
        │ Issue extraction                 │
        │ Repair-cost estimate             │
        │ Fraud/risk analysis              │
        └──────────────────┬───────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   DEAL SCORE ENGINE   │
               │                       │
               │ Discount              │
               │ Net margin            │
               │ Repairs               │
               │ Title confidence      │
               │ Fraud risk            │
               │ Liquidity             │
               └───────────┬───────────┘
                           │
                           ▼
           ┌───────────────────────────────┐
           │          DEAL INBOX           │
           │ 🔥 Exceptional                │
           │ ✅ Strong                     │
           │ ⚠️ Investigate                │
           │ ❌ Reject                     │
           └──────────────┬────────────────┘
                          │
                          ▼
                 ALERT → REVIEW → BUY
```

---

# 3. Priority order

| Priority | Component                            |
| -------- | ------------------------------------ |
| **3**    | Deal math / scoring engine           |
| **3**    | Listing normalization                |
| **3**    | Vehicle valuation                    |
| **3**    | VIN + title verification             |
| **3**    | Search/filter engine                 |
| **3**    | Facebook-safe ingestion architecture |
| **2**    | Repair estimation                    |
| **2**    | Automated alerts                     |
| **2**    | Comparable-market analysis           |
| **2**    | Scam/fraud detection                 |
| **2**    | Listing photo analysis               |
| **1**    | Seller/contact workflow              |
| **1**    | Historical deal tracking             |
| **1**    | Purchase/inspection workflow         |
| **1**    | Adaptive ML based on outcomes        |
| **0**    | Full autonomous buying/contacting    |

---

# 4. Critical constraint: Facebook Marketplace

I would **not build production v1 around an unofficial Facebook scraper**.

Meta's current Automated Data Collection Terms state that automated collection requires Meta's express written permission. Its general Terms similarly prohibit automated access/collection without permission, including access performed while logged into Facebook. ([Facebook][1])

That means architect Facebook as a **replaceable source adapter**, not the foundation of the product.

### MVP Facebook workflow

Use Facebook itself for discovery:

```text
Facebook saved search
      ↓
Marketplace notification
      ↓
User finds listing
      ↓
Share/copy listing information into DealHound
      ↓
DealHound evaluates it automatically
```

Accept:

* Screenshot(s)
* Copied listing description
* Asking price
* Mileage
* Location
* VIN, if shown
* Listing URL as reference
* Seller-provided VIN later

The software can OCR screenshots and extract structured information without programmatically crawling Facebook.

### Production Facebook integration

Implement only when one of these becomes available:

1. Meta grants appropriate automated-data permission.
2. Meta provides an applicable supported Marketplace API/partner integration.
3. A properly licensed data provider supplies the listing feed.

The rest of the application should remain unchanged.

---

# 5. Add a fully automated discovery source immediately

This prevents Facebook from blocking development of the actual product.

A strong current candidate is **MarketCheck**.

Its APIs currently advertise:

* Private-party inventory
* Auction inventory
* Dealer inventory
* VIN decoding
* Vehicle histories
* Comparable vehicles
* Market-value predictions
* Geographic search
* 100+ search parameters ([MarketCheck Docs][2])

So architect:

```typescript
interface ListingSource {
  search(profile: SearchProfile): Promise<Listing[]>;
  getListing(id: string): Promise<Listing>;
}
```

Implement:

```text
FacebookManualAdapter
MarketCheckAdapter
FutureFacebookAuthorizedAdapter
FutureCraigslistAdapter
FutureOfferUpAdapter
FutureAuctionAdapter
```

The scoring engine never needs to know where the car came from.

---

# 6. Search profile system

Users create reusable searches.

Example:

```json
{
  "name": "Cheap Japanese Commuters",
  "location": {
    "zip": "08054",
    "radius_miles": 75
  },
  "years": {
    "min": 2012,
    "max": 2022
  },
  "makes": [
    "Toyota",
    "Honda",
    "Lexus",
    "Acura"
  ],
  "price": {
    "max": 12000
  },
  "mileage": {
    "max": 160000
  },
  "title": {
    "required": "clean"
  },
  "max_asking_to_reference_ratio": 0.70,
  "repair_preferences": {
    "cosmetic": true,
    "brakes": true,
    "suspension": true,
    "tires": true,
    "ac": true,
    "electrical_minor": true,
    "engine_internal": false,
    "transmission_internal": false,
    "frame_damage": false,
    "flood": false
  }
}
```

---

# 7. Listing normalization

Every imported listing becomes one canonical object:

```text
Listing

source
source_listing_id
source_url

asking_price

year
make
model
trim

VIN
mileage

city
state
ZIP
distance

description

seller_type
seller_name

photos[]

claimed_title_status

detected_issues[]
detected_positive_signals[]
detected_red_flags[]

first_seen
last_seen
price_history[]
```

Every later service operates on this structure.

---

# 8. VIN enrichment

The VIN should become the primary identity whenever available.

Use it to determine:

* Exact year
* Make
* Model
* Trim where possible
* Engine
* Drivetrain
* Body style
* Equipment
* Manufacturer information

NHTSA provides the publicly accessible vPIC VIN decoder and developer API for vehicle specifications. ([NHTSA][3])

### VIN states

```text
VIN_MISSING
VIN_CLAIMED
VIN_VALIDATED
VIN_DECODED
VIN_MISMATCH
```

If the seller's description says:

```text
2017 Accord EX-L
```

but the VIN resolves to:

```text
2017 Accord LX
```

flag it.

---

# 9. Title verification engine

Do **not** treat:

> "clean title"

inside a Marketplace description as verified.

Use progressive confidence:

```text
0 — UNKNOWN
1 — SELLER_CLAIMS_CLEAN
2 — VIN_HISTORY_NO_BRANDS
3 — TITLE_DOCUMENT_REVIEWED
4 — TITLE/OWNER/LIEN VERIFIED
```

NMVTIS reports can identify title state/date and historical brands such as junk, salvage and flood. The DOJ maintains a list of approved providers. ([VehicleHistory][4])

MarketCheck also currently lists a VINData title-status integration among its APIs. ([MarketCheck][5])

### Hard rejection rules

```text
SALVAGE
REBUILT
FLOOD
JUNK
PARTS_ONLY
CERTIFICATE_OF_DESTRUCTION
VIN_MISMATCH
```

unless the user explicitly permits them.

For your stated search:

```text
required_title_status = CLEAN
```

---

# 10. Valuation engine

Use a provider abstraction.

```typescript
interface ValuationProvider {
  getValue(vehicle: Vehicle): Promise<Valuation>;
}
```

Possible providers:

```text
KBBAdapter
MarketCheckAdapter
ComparableSalesAdapter
ManualValuationAdapter
```

## KBB

KBB currently offers its **InfoDriver Web Service** for incorporating KBB values into software/applications. KBB also publishes private-party valuation ranges based on condition. ([B2B KBB][6])

However, KBB's licensing terms govern how its output and trademarks may be displayed or reused. ([Cox Automotive Inc.][7])

Therefore:

### MVP

```text
MarketCheck value
+ comparable-market calculation
+ optional manually supplied KBB Good value
```

### Production

```text
Licensed KBB InfoDriver
+ MarketCheck
+ comparable-market calculation
```

---

# 11. Never trust one valuation

Calculate:

```text
KBB Good Private Party
MarketCheck predicted value
Comparable median
Comparable 25th percentile
Comparable 75th percentile
```

Then derive:

```text
Conservative Value =
MIN(
  KBB Good value,
  MarketCheck value,
  comparable median
)
```

This protects against one overly optimistic valuation source.

---

# 12. Core 70%-of-KBB filter

Calculate:

```text
asking_ratio =
asking_price / KBB_good_value
```

Example:

```text
KBB Good = $15,000
Asking = $9,500

$9,500 / $15,000 = 63.3%
```

Result:

```text
ASKING-PRICE TEST = PASS
```

Discount:

```text
36.7%
```

---

# 13. Repair detection engine

This is where the product becomes significantly more useful than a normal vehicle search.

Feed:

```text
listing title
description
seller statements
photos
VIN data
```

into an issue classifier.

Output:

```json
{
  "issues": [
    {
      "category": "brakes",
      "issue": "front brakes likely needed",
      "severity": "medium",
      "confidence": 0.88,
      "estimated_cost_low": 300,
      "estimated_cost_high": 650
    }
  ]
}
```

---

# 14. Repair taxonomy

### Ideal repair candidates

```text
tires
brakes
battery
alternator
starter
wheel bearing
shocks
struts
control arms
minor exhaust
windshield
minor electrical
A/C
interior
paint
bumper
lights
sensors
routine maintenance
```

### Higher-risk

```text
oil leak
coolant leak
misfire
timing chain
turbo
AWD system
HVAC evaporator
electrical faults
rust
```

### Default reject

```text
engine knock
low compression
blown engine
head gasket
overheating
transmission slipping
transmission replacement
frame damage
flood
fire
severe rust
VIN/title irregularity
```

All categories should be user-configurable.

---

# 15. Repair cost engine

Maintain a repair catalog:

```text
repair_type
vehicle_class
parts_low
parts_high
labor_hours_low
labor_hours_high
difficulty
risk_multiplier
```

Then:

```text
Repair Estimate =
Parts
+ Labor
+ Diagnostics
+ Uncertainty Reserve
```

Provide:

```text
Best case:       $650
Expected:      $1,150
Worst case:    $2,300
```

Never just show one number.

---

# 16. All-in acquisition basis

This is the critical calculation.

```text
Purchase price
+ repairs
+ inspection
+ transportation
+ fees
+ taxes/title
+ immediate maintenance
+ risk reserve
────────────────────────
= ALL-IN BASIS
```

Example:

```text
Purchase                $9,500
Expected repairs          1,200
Inspection                  200
Transport                   150
Registration/etc.           400
Risk reserve                500
────────────────────────────────
All-in                  $11,950
```

If conservative finished value is:

```text
$15,000
```

then:

```text
all_in_ratio = 79.7%
```

This car may still be attractive.

---

# 17. Two-stage deal qualification

Require both.

## Gate A — asking-price bargain

```text
asking_price / KBB_good <= 0.70
```

## Gate B — actual economic bargain

Recommended configurable starting threshold:

```text
all_in_basis / conservative_value <= 0.80
```

Thus:

```text
Cheap listing ≠ good deal.
```

---

# 18. Deal scoring

Score each vehicle 0–100.

Recommended model:

| Component                  |  Weight |
| -------------------------- | ------: |
| Price discount             |      30 |
| Net economics after repair |      25 |
| Title/history confidence   |      15 |
| Repair risk                |      10 |
| Market liquidity           |       8 |
| Listing/seller confidence  |       7 |
| Distance/logistics         |       5 |
| **Total**                  | **100** |

Then classify:

```text
90–100   🔥 EXCEPTIONAL
80–89    🟢 STRONG BUY
70–79    🟡 INVESTIGATE
50–69    🟠 HIGH RISK
0–49     🔴 REJECT
```

---

# 19. Add a “Deal Margin” metric

This should be the most prominent number in the UI.

```text
Deal Margin =
Conservative Finished Value
-
Expected All-In Basis
```

Example:

```text
Finished value:       $15,000
Expected all-in:      $11,950
────────────────────────────
Deal margin:           $3,050
```

Also calculate:

```text
Best-case margin
Expected margin
Worst-case margin
```

---

# 20. Fraud/scam detector

Flag listings containing patterns such as:

```text
deposit before viewing
shipping only
seller unavailable
selling for family member
gift cards
WhatsApp-only contact
price dramatically below every comparable
VIN refusal
title unavailable
name doesn't match title
duplicate description
location inconsistencies
```

Score:

```text
fraud_risk = 0–100
```

A huge discount should actually **increase fraud scrutiny**.

---

# 21. Photo intelligence

Phase 2 can analyze listing photos for:

```text
body damage
mismatched paint
panel gaps
rust
flat tires
warning lights
windshield damage
missing trim
interior damage
airbag indicators
obvious collision damage
engine bay condition
```

Output should be:

```text
OBSERVED
SUSPECTED
UNKNOWN
```

—not definitive mechanical diagnoses.

---

# 22. Dashboard

## Main screen

```text
┌────────────────────────────────────────────────────────┐
│ DEALHOUND                                              │
├────────────────────────────────────────────────────────┤
│ 🔥 7 Exceptional     🟢 18 Strong     🟡 42 Review     │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 2017 Honda Accord EX-L                                 │
│ $8,900                                                 │
│                                                        │
│ KBB Good:             $14,200                          │
│ Asking/KBB:              62.7%                         │
│ Repairs:              ~$1,250                          │
│ All-in:              ~$10,850                          │
│ Finished value:       $14,000                          │
│ Expected margin:       $3,150                          │
│                                                        │
│ TITLE: ✅ Clean history                                │
│ DEAL SCORE: 93/100 🔥                                  │
│                                                        │
│ Issues: brakes • tires • A/C                           │
│                                                        │
│ [View Listing] [Analyze] [Contact] [Reject]             │
└────────────────────────────────────────────────────────┘
```

---

# 23. Filters

Support:

### Vehicle

```text
Make
Model
Trim
Year
Engine
Transmission
Drivetrain
Body style
```

### Financial

```text
Price
% of KBB
% of market value
Maximum repair estimate
Maximum all-in basis
Minimum deal margin
```

### Condition

```text
Mileage
Repair categories
Running/non-running
Cosmetic damage
Mechanical damage
```

### Risk

```text
Clean title only
No accident history
No flood
No salvage
VIN required
Max fraud score
```

### Geography

```text
ZIP
Radius
Distance
State
```

---

# 24. Alerts

Instead of:

> New Toyota Camry listed.

Send:

> **🔥 92/100 Deal — 2016 Toyota Camry**
>
> Asking: $6,900
> Reference: $10,800
> Asking/reference: 64%
> Estimated repairs: $700–$1,300
> Expected all-in: $8,150
> Expected margin: $2,650
> Clean-title history: Yes
> Distance: 27 miles

Send only when configurable conditions are met.

Example:

```text
score >= 85
AND asking_ratio <= .70
AND title_status >= HISTORY_CLEAN
AND expected_margin >= $2,000
AND major_mechanical_risk == false
```

---

# 25. Seller workflow

For promising vehicles:

```text
FOUND
  ↓
VIN REQUESTED
  ↓
VIN VERIFIED
  ↓
TITLE CHECKED
  ↓
SELLER QUESTIONS
  ↓
INSPECTION REQUESTED
  ↓
INSPECTION PASSED
  ↓
OFFER MADE
  ↓
PURCHASED / LOST / REJECTED
```

Store every transition.

---

# 26. Question generator

Automatically create the next questions based on detected issues.

Example:

```text
Listing says:
"Runs good, needs a little front end work."

Software asks:

1. What specifically is wrong with the front end?
2. Has it been diagnosed by a shop?
3. Any accidents?
4. Can you send the VIN?
5. Any warning lights?
6. Does it drive straight?
7. Any vibration while driving or braking?
8. Is the title physically in your name?
```

That turns ambiguous seller language into usable underwriting information.

---

# 27. Feedback loop

Every evaluated vehicle should eventually receive an outcome:

```text
purchased
seller_unresponsive
bad_title
inspection_failed
repairs_too_expensive
sold_before_contact
price_too_high
scam
good_deal_lost
other
```

For purchased vehicles record:

```text
predicted repairs
actual repairs

predicted value
actual market value

predicted margin
actual margin
```

Then calculate:

```text
repair-estimation error
valuation error
deal-score accuracy
```

This eventually makes **your own proprietary scoring model** much more valuable than KBB alone.

---

# 28. Recommended technical stack

Keep the first version low-ops:

```text
Frontend
Next.js
TypeScript
shadcn/ui

Backend
Next.js server routes/actions

Database
PostgreSQL

ORM
Drizzle

File storage
S3-compatible object storage

Jobs
Serverless scheduled jobs / queue

AI
Structured-output LLM
Vision model for photos
OCR for FB screenshots

External data
NHTSA vPIC
MarketCheck
NMVTIS-approved title provider
KBB InfoDriver later

Notifications
Email
Push
Slack/Telegram optional

Deployment
Vercel-style serverless deployment
```

Do **not** start with microservices.

One application + PostgreSQL + jobs is sufficient.

---

# 29. Core database model

```text
users
search_profiles
sources
listings
vehicles
listing_photos

vin_decodes
valuations
comparables
title_checks

detected_issues
repair_estimates

deal_scores
deal_score_components

seller_interactions
inspections
offers

purchases
actual_repairs
outcomes

alerts
audit_events
```

---

# 30. Implementation sequence

## Phase 0 — Requirements + policy

Build:

* Search-profile schema
* Deal qualification rules
* Title-state taxonomy
* Repair taxonomy
* Valuation-provider abstraction
* Source-provider abstraction
* Facebook ingestion constraints
* Data retention rules

**DoD:** no component assumes Facebook scraping or KBB scraping.

---

## Phase 1 — Deal engine

Implement:

```text
asking/reference ratio
discount %
repair estimate
all-in basis
all-in/reference ratio
potential margin
deal score
hard reject rules
```

Write comprehensive unit tests before building the discovery system.

---

## Phase 2 — Vehicle intelligence

Implement:

* VIN validation
* NHTSA decode
* Trim normalization
* Mileage normalization
* Market valuation
* Comparable calculation

---

## Phase 3 — Title intelligence

Implement:

* Seller-claimed title status
* VIN history lookup
* Brand detection
* Title confidence
* Hard rejection

Never display `VERIFIED CLEAN` solely because the seller wrote "clean title."

---

## Phase 4 — Repair intelligence

Implement:

```text
description → issue extraction
issue → repair category
repair category → price estimate
issue severity
confidence
uncertainty reserve
major-risk detection
```

---

## Phase 5 — Facebook MVP

Create:

### Import Listing

User supplies:

```text
screenshots
copied text
price
mileage
location
VIN if available
URL for reference
```

System automatically performs everything **after import**.

This gives you the real product without making Facebook scraping the blocker.

---

## Phase 6 — Automated discovery

Add MarketCheck or another licensed inventory source.

Pipeline:

```text
cron
 ↓
search profiles
 ↓
provider search
 ↓
deduplicate
 ↓
normalize
 ↓
VIN enrichment
 ↓
valuation
 ↓
deal filter
 ↓
repair analysis
 ↓
score
 ↓
alert
```

Now DealHound autonomously discovers deals even before an authorized Facebook integration exists.

---

## Phase 7 — Dashboard + alerts

Build:

* Deal inbox
* Vehicle detail page
* Filters
* Search profiles
* Deal-score explanation
* Valuation comparison
* Repair analysis
* Title/history panel
* Watchlist
* Reject
* Contact queue

---

## Phase 8 — Seller/inspection workflow

Build:

* VIN-request workflow
* Question generator
* Inspection checklist
* Seller notes
* Offer tracking
* Purchase decision
* Outcome recording

---

## Phase 9 — Intelligence feedback loop

Use actual results to recalibrate:

```text
repair costs
risk premiums
vehicle-specific reliability
valuation accuracy
ideal discount
minimum profit
preferred repairs
preferred models
```

---

# 31. MVP Definition of Done

The MVP is **done** when:

* [ ] User can create multiple vehicle search profiles.
* [ ] Search profiles support radius, price, year, mileage, make/model and title requirements.
* [ ] User can import a Facebook Marketplace listing without the application scraping Facebook.
* [ ] Screenshots/text are converted into structured listing data.
* [ ] VINs are validated and decoded.
* [ ] Exact vehicle configuration is normalized.
* [ ] At least one automated valuation provider works.
* [ ] KBB Good value can be manually supplied until licensed API access exists.
* [ ] `asking price ÷ reference value` is calculated.
* [ ] Listings >70% are automatically rejected under the configured rule.
* [ ] Clean-title status distinguishes claimed from independently checked.
* [ ] Title brands automatically reject vehicles.
* [ ] Listing descriptions are analyzed for required repairs.
* [ ] Repair estimates include low/expected/high ranges.
* [ ] Major mechanical issues can automatically reject vehicles.
* [ ] All-in acquisition cost is calculated.
* [ ] Conservative finished value is calculated.
* [ ] Expected profit/margin is calculated.
* [ ] Every listing receives a transparent 0–100 deal score.
* [ ] User can see exactly why the score was assigned.
* [ ] User receives configurable alerts for qualifying vehicles.
* [ ] Duplicate listings are suppressed.
* [ ] Vehicle/listing price history is retained.
* [ ] User can mark deals contacted/rejected/inspected/purchased.
* [ ] Actual repair costs can be entered afterward.
* [ ] Predicted-vs-actual economics are measured.

---

# 32. What I would build first

The optimal first release is **not a Facebook scraper**.

Build this:

```text
                     DEALHOUND V1

Facebook Marketplace              MarketCheck
manual/share intake               automated search
        │                              │
        └──────────────┬───────────────┘
                       ▼
                Vehicle Parser
                       ↓
                   VIN Decode
                       ↓
          ┌────────────┴────────────┐
          ▼                         ▼
      Valuation                 Title Check
          │                         │
          └────────────┬────────────┘
                       ▼
                Repair Analyzer
                       ↓
                 Deal Economics
                       ↓
                 Deal Score 0–100
                       ↓
              Hard Filter ≤70%
                       ↓
                  🔥 ALERT 🔥
```

This separates the two actually valuable pieces:

**Discovery:** *Where can I find underpriced cars?*

**Underwriting:** *Is this particular car really cheap after I account for its title, condition, repairs, market value and risk?*

The second piece is the defensible software. Once that works, Facebook Marketplace becomes only **one of many interchangeable acquisition feeds** rather than the system's single point of failure. ([MarketCheck Docs][8])

I can also monitor changes to Meta Marketplace access and KBB integration options so the Facebook/KBB adapters can be upgraded when a better authorized path becomes available.

[1]: https://www.facebook.com/apps/site_scraping_tos_terms.php?utm_source=chatgpt.com "Facebook"
[2]: https://docs.marketcheck.com/docs/get-started/api/introduction?utm_source=chatgpt.com "Introduction - API - Get Started | MarketCheck Documentation"
[3]: https://www.nhtsa.gov/vin-decoder?utm_source=chatgpt.com "VIN Decoder | NHTSA"
[4]: https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory?utm_source=chatgpt.com "Research Vehicle History | VehicleHistory"
[5]: https://www.marketcheck.com/apis/?utm_source=chatgpt.com "Vehicle Data APIs | MarketCheck Automotive Intelligence"
[6]: https://b2b.kbb.com/industry-solutions/?utm_source=chatgpt.com "Industry Solutions | B2B KBB"
[7]: https://www.coxautoinc.com/terms/wp-content/uploads/sites/3/Kelley-Blue-Book-InfoDriver-Additional-Terms.pdf?utm_source=chatgpt.com "Cox Confidential"
[8]: https://docs.marketcheck.com/docs/api/cars/market-insights/marketcheck-price?utm_source=chatgpt.com "MarketCheck Price™ - Cars APIs | MarketCheck Documentation"
