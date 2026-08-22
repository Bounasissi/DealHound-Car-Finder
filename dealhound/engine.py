from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Protocol


class VinState(str, Enum):
    VIN_MISSING = "VIN_MISSING"
    VIN_CLAIMED = "VIN_CLAIMED"
    VIN_VALIDATED = "VIN_VALIDATED"
    VIN_DECODED = "VIN_DECODED"
    VIN_MISMATCH = "VIN_MISMATCH"


class TitleConfidence(int, Enum):
    UNKNOWN = 0
    SELLER_CLAIMS_CLEAN = 1
    VIN_HISTORY_NO_BRANDS = 2
    TITLE_DOCUMENT_REVIEWED = 3
    TITLE_OWNER_LIEN_VERIFIED = 4


class TitleBrand(str, Enum):
    CLEAN = "CLEAN"
    SALVAGE = "SALVAGE"
    REBUILT = "REBUILT"
    FLOOD = "FLOOD"
    JUNK = "JUNK"
    PARTS_ONLY = "PARTS_ONLY"
    CERTIFICATE_OF_DESTRUCTION = "CERTIFICATE_OF_DESTRUCTION"
    UNKNOWN = "UNKNOWN"


class DealBand(str, Enum):
    EXCEPTIONAL = "EXCEPTIONAL"
    STRONG_BUY = "STRONG_BUY"
    INVESTIGATE = "INVESTIGATE"
    HIGH_RISK = "HIGH_RISK"
    REJECT = "REJECT"


@dataclass(frozen=True)
class RepairPreferences:
    allowed_categories: set[str] = field(default_factory=set)
    rejected_categories: set[str] = field(default_factory=lambda: {"engine_internal", "transmission_internal", "frame_damage", "flood"})


@dataclass(frozen=True)
class SearchProfile:
    max_asking_to_reference_ratio: float = 0.70
    max_all_in_to_conservative_ratio: float = 0.80
    required_title_clean: bool = True
    min_title_confidence: TitleConfidence = TitleConfidence.SELLER_CLAIMS_CLEAN
    min_margin: float = 0.0
    repair_preferences: RepairPreferences = field(default_factory=RepairPreferences)


@dataclass(frozen=True)
class RepairIssue:
    category: str
    severity: str
    confidence: float
    estimated_cost_low: float
    estimated_cost_high: float
    major_mechanical_risk: bool = False


@dataclass(frozen=True)
class RepairEstimateRange:
    low: float
    expected: float
    high: float


@dataclass(frozen=True)
class Valuation:
    kbb_good_value: float | None = None
    marketcheck_value: float | None = None
    comparable_median: float | None = None

    def conservative_value(self) -> float:
        values = [v for v in (self.kbb_good_value, self.marketcheck_value, self.comparable_median) if v is not None and v > 0]
        if not values:
            raise ValueError("At least one positive valuation source is required")
        return min(values)


@dataclass(frozen=True)
class Listing:
    source: str
    source_listing_id: str
    asking_price: float
    year: int | None = None
    make: str | None = None
    model: str | None = None
    trim: str | None = None
    vin: str | None = None
    mileage: int | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    description: str = ""
    claimed_title_status: TitleBrand = TitleBrand.UNKNOWN
    detected_issues: tuple[RepairIssue, ...] = ()
    detected_red_flags: tuple[str, ...] = ()
    vin_state: VinState = VinState.VIN_MISSING
    title_confidence: TitleConfidence = TitleConfidence.UNKNOWN


@dataclass(frozen=True)
class DealComputation:
    asking_ratio: float
    all_in_basis: float
    all_in_ratio: float
    conservative_value: float
    expected_margin: float
    best_case_margin: float
    worst_case_margin: float
    repair_estimate: RepairEstimateRange
    gate_a_pass: bool
    gate_b_pass: bool


@dataclass(frozen=True)
class DealDecision:
    accepted: bool
    score: int
    band: DealBand
    reject_reasons: tuple[str, ...]
    computation: DealComputation


class ListingSource(Protocol):
    def search(self, profile: SearchProfile) -> list[Listing]:
        ...

    def get_listing(self, listing_id: str) -> Listing:
        ...


class ValuationProvider(Protocol):
    def get_value(self, listing: Listing) -> Valuation:
        ...


HARD_REJECT_TITLE_BRANDS = {
    TitleBrand.SALVAGE,
    TitleBrand.REBUILT,
    TitleBrand.FLOOD,
    TitleBrand.JUNK,
    TitleBrand.PARTS_ONLY,
    TitleBrand.CERTIFICATE_OF_DESTRUCTION,
}


def normalize_listing(raw: dict[str, Any]) -> Listing:
    return Listing(
        source=str(raw.get("source", "manual")),
        source_listing_id=str(raw.get("source_listing_id", "")),
        asking_price=float(raw["asking_price"]),
        year=int(raw["year"]) if raw.get("year") is not None else None,
        make=raw.get("make"),
        model=raw.get("model"),
        trim=raw.get("trim"),
        vin=raw.get("vin"),
        mileage=int(raw["mileage"]) if raw.get("mileage") is not None else None,
        city=raw.get("city"),
        state=raw.get("state"),
        zip_code=raw.get("zip_code"),
        description=str(raw.get("description", "")),
        claimed_title_status=TitleBrand(raw.get("claimed_title_status", TitleBrand.UNKNOWN)),
        detected_issues=tuple(raw.get("detected_issues", ())),
        detected_red_flags=tuple(raw.get("detected_red_flags", ())),
        vin_state=VinState(raw.get("vin_state", VinState.VIN_MISSING)),
        title_confidence=TitleConfidence(raw.get("title_confidence", TitleConfidence.UNKNOWN)),
    )


def compute_deal(
    listing: Listing,
    valuation: Valuation,
    profile: SearchProfile,
    *,
    inspection_cost: float = 200.0,
    transport_cost: float = 0.0,
    transaction_cost: float = 0.0,
    immediate_maintenance: float = 0.0,
    risk_reserve: float = 0.0,
) -> DealDecision:
    reject_reasons: list[str] = []

    if listing.vin_state == VinState.VIN_MISMATCH:
        reject_reasons.append("VIN_MISMATCH")
    if listing.claimed_title_status in HARD_REJECT_TITLE_BRANDS:
        reject_reasons.append(f"TITLE_{listing.claimed_title_status.value}")
    if profile.required_title_clean and listing.claimed_title_status not in {TitleBrand.CLEAN, TitleBrand.UNKNOWN}:
        reject_reasons.append("NOT_CLEAN_TITLE")
    if listing.title_confidence < profile.min_title_confidence:
        reject_reasons.append("LOW_TITLE_CONFIDENCE")

    repair_low = sum(i.estimated_cost_low for i in listing.detected_issues)
    repair_high = sum(i.estimated_cost_high for i in listing.detected_issues)
    repair_expected = (repair_low + repair_high) / 2 if listing.detected_issues else 0.0

    for issue in listing.detected_issues:
        if issue.major_mechanical_risk:
            reject_reasons.append("MAJOR_MECHANICAL_RISK")
            break
        if issue.category in profile.repair_preferences.rejected_categories:
            reject_reasons.append(f"REPAIR_CATEGORY_REJECTED:{issue.category}")
            break

    conservative_value = valuation.conservative_value()
    asking_ratio = listing.asking_price / conservative_value

    gate_a_pass = asking_ratio <= profile.max_asking_to_reference_ratio

    all_in_basis = (
        listing.asking_price
        + repair_expected
        + inspection_cost
        + transport_cost
        + transaction_cost
        + immediate_maintenance
        + risk_reserve
    )
    all_in_ratio = all_in_basis / conservative_value
    gate_b_pass = all_in_ratio <= profile.max_all_in_to_conservative_ratio

    best_case_margin = conservative_value - (
        listing.asking_price + repair_low + inspection_cost + transport_cost + transaction_cost + immediate_maintenance + risk_reserve
    )
    expected_margin = conservative_value - all_in_basis
    worst_case_margin = conservative_value - (
        listing.asking_price + repair_high + inspection_cost + transport_cost + transaction_cost + immediate_maintenance + risk_reserve
    )

    if expected_margin < profile.min_margin:
        reject_reasons.append("MARGIN_BELOW_MINIMUM")
    if not gate_a_pass:
        reject_reasons.append("ASKING_RATIO_TOO_HIGH")
    if not gate_b_pass:
        reject_reasons.append("ALL_IN_RATIO_TOO_HIGH")

    score = _score(listing, asking_ratio=asking_ratio, all_in_ratio=all_in_ratio, expected_margin=expected_margin, gate_a_pass=gate_a_pass, gate_b_pass=gate_b_pass)
    band = _band_for(score)

    computation = DealComputation(
        asking_ratio=asking_ratio,
        all_in_basis=all_in_basis,
        all_in_ratio=all_in_ratio,
        conservative_value=conservative_value,
        expected_margin=expected_margin,
        best_case_margin=best_case_margin,
        worst_case_margin=worst_case_margin,
        repair_estimate=RepairEstimateRange(low=repair_low, expected=repair_expected, high=repair_high),
        gate_a_pass=gate_a_pass,
        gate_b_pass=gate_b_pass,
    )
    return DealDecision(
        accepted=len(reject_reasons) == 0,
        score=score,
        band=band,
        reject_reasons=tuple(dict.fromkeys(reject_reasons)),
        computation=computation,
    )


def _score(
    listing: Listing,
    *,
    asking_ratio: float,
    all_in_ratio: float,
    expected_margin: float,
    gate_a_pass: bool,
    gate_b_pass: bool,
) -> int:
    discount_score = max(0.0, min(1.0, (0.70 - asking_ratio) / 0.20 + 0.5)) * 30
    economics_score = max(0.0, min(1.0, (0.80 - all_in_ratio) / 0.20 + 0.5)) * 25

    title_score = 15.0
    if listing.claimed_title_status != TitleBrand.CLEAN:
        title_score -= 8.0
    title_score -= (4 - int(listing.title_confidence)) * 1.5
    title_score = max(0.0, min(15.0, title_score))

    repair_risk_score = 10.0
    if any(i.major_mechanical_risk for i in listing.detected_issues):
        repair_risk_score = 0.0
    elif len(listing.detected_issues) > 3:
        repair_risk_score = 6.0

    liquidity_score = 8.0
    seller_confidence_score = max(0.0, 7.0 - len(listing.detected_red_flags))
    distance_logistics_score = 5.0

    score = int(round(discount_score + economics_score + title_score + repair_risk_score + liquidity_score + seller_confidence_score + distance_logistics_score))
    if not gate_a_pass:
        score = min(score, 69)
    if not gate_b_pass:
        score = min(score, 69)
    if expected_margin <= 0:
        score = min(score, 59)
    return max(0, min(100, score))


def _band_for(score: int) -> DealBand:
    if score >= 90:
        return DealBand.EXCEPTIONAL
    if score >= 80:
        return DealBand.STRONG_BUY
    if score >= 70:
        return DealBand.INVESTIGATE
    if score >= 50:
        return DealBand.HIGH_RISK
    return DealBand.REJECT
