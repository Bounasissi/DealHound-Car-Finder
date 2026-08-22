import unittest

from dealhound.engine import (
    Listing,
    RepairIssue,
    SearchProfile,
    TitleBrand,
    TitleConfidence,
    Valuation,
    VinState,
    compute_deal,
)


class DealEngineTests(unittest.TestCase):
    def test_passes_when_under_70_percent_and_all_in_under_80_percent(self) -> None:
        listing = Listing(
            source="manual",
            source_listing_id="1",
            asking_price=9500,
            year=2017,
            make="Honda",
            model="Accord",
            claimed_title_status=TitleBrand.CLEAN,
            title_confidence=TitleConfidence.VIN_HISTORY_NO_BRANDS,
            vin_state=VinState.VIN_VALIDATED,
            detected_issues=(
                RepairIssue("brakes", "medium", 0.88, 300, 650),
                RepairIssue("tires", "medium", 0.85, 450, 700),
            ),
        )
        valuation = Valuation(kbb_good_value=15000, marketcheck_value=15200, comparable_median=14800)
        profile = SearchProfile()

        result = compute_deal(
            listing,
            valuation,
            profile,
            inspection_cost=200,
            transaction_cost=400,
            risk_reserve=500,
        )

        self.assertTrue(result.computation.gate_a_pass)
        self.assertTrue(result.computation.gate_b_pass)
        self.assertTrue(result.accepted)
        self.assertGreater(result.score, 70)

    def test_rejects_when_all_in_fails_even_if_asking_ratio_passes(self) -> None:
        listing = Listing(
            source="manual",
            source_listing_id="2",
            asking_price=7000,
            claimed_title_status=TitleBrand.CLEAN,
            title_confidence=TitleConfidence.VIN_HISTORY_NO_BRANDS,
            detected_issues=(RepairIssue("electrical_minor", "high", 0.8, 2500, 3500),),
        )
        valuation = Valuation(kbb_good_value=11000, marketcheck_value=11500, comparable_median=10800)
        profile = SearchProfile()

        result = compute_deal(listing, valuation, profile, inspection_cost=200, transaction_cost=400, risk_reserve=500)

        self.assertTrue(result.computation.gate_a_pass)
        self.assertFalse(result.computation.gate_b_pass)
        self.assertIn("ALL_IN_RATIO_TOO_HIGH", result.reject_reasons)
        self.assertFalse(result.accepted)

    def test_hard_rejects_salvage_title(self) -> None:
        listing = Listing(
            source="manual",
            source_listing_id="3",
            asking_price=5000,
            claimed_title_status=TitleBrand.SALVAGE,
            title_confidence=TitleConfidence.SELLER_CLAIMS_CLEAN,
        )
        valuation = Valuation(kbb_good_value=10000)
        profile = SearchProfile()

        result = compute_deal(listing, valuation, profile)

        self.assertFalse(result.accepted)
        self.assertIn("TITLE_SALVAGE", result.reject_reasons)

    def test_rejects_vin_mismatch(self) -> None:
        listing = Listing(
            source="manual",
            source_listing_id="4",
            asking_price=6000,
            claimed_title_status=TitleBrand.CLEAN,
            title_confidence=TitleConfidence.VIN_HISTORY_NO_BRANDS,
            vin_state=VinState.VIN_MISMATCH,
        )
        valuation = Valuation(kbb_good_value=10000)
        profile = SearchProfile()

        result = compute_deal(listing, valuation, profile)

        self.assertIn("VIN_MISMATCH", result.reject_reasons)
        self.assertFalse(result.accepted)

    def test_conservative_value_uses_minimum_source(self) -> None:
        valuation = Valuation(kbb_good_value=14000, marketcheck_value=13000, comparable_median=13500)
        self.assertEqual(valuation.conservative_value(), 13000)


if __name__ == "__main__":
    unittest.main()
