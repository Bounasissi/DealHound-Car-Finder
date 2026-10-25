/**
 * Seed: default profile + listings spanning all score classes,
 * each with valuation + history check + full evaluation.
 * Safe to re-run: dedup keys prevent duplicate listings.
 */
import { loadConfig } from "../src/domain/config";
import { normalizeListing } from "../src/domain/normalize";
import type { RawListing } from "../src/domain/types";
import { evaluateAndStore } from "../src/lib/evaluate";
import { addHistoryCheck, addValuation, createProfile, listProfiles, upsertListing } from "../src/lib/repo";
import { seedHistoryCheck } from "../src/sources/history";

const SEED_LISTINGS: Array<{ raw: RawListing; kbbGood: number }> = [
  {
    // EXCEPTIONAL: 50% of KBB, minor wear only, clean history
    raw: {
      sourceId: "facebook-marketplace-manual",
      sourceKind: "marketplace-screenshot",
      title: "2016 Toyota Camry LE",
      description:
        "2016 Toyota Camry LE. Clean title in hand. 98k highway miles. Runs and drives perfect, just had inspection. Cosmetic: small dent on rear door. New battery. $7,200 firm.",
      price: 7200,
      mileage: 98000,
      location: "Mount Laurel, NJ",
      vin: "4T1BF1FK5FU100274",
      year: 2016,
      make: "toyota",
      model: "Camry",
      trim: "LE",
      sellerName: "Mike",
      sellerType: "private",
      sellerContact: "(555) 010-2030",
    },
    kbbGood: 14400,
  },
  {
    // STRONG BUY: ~57% of KBB, manageable repairs (tires/brakes), clean history
    raw: {
      sourceId: "facebook-marketplace-manual",
      sourceKind: "marketplace-screenshot",
      title: "2014 Honda Accord EX",
      description:
        "2014 Honda Accord EX, clean title. 115k miles. Needs new tires soon and brakes will need attention in the next few months. Otherwise runs great, cold AC. $8,900 obo.",
      price: 8900,
      mileage: 115000,
      location: "Cherry Hill, NJ",
      vin: "1HGCR2F77EA128765",
      year: 2014,
      make: "honda",
      model: "Accord",
      trim: "EX",
      sellerName: "Dana",
      sellerType: "private",
      sellerContact: "message via marketplace",
    },
    kbbGood: 15500,
  },
  {
    // INVESTIGATE: passes Gate A but heavier repair load pushes economics
    raw: {
      sourceId: "facebook-marketplace-manual",
      sourceKind: "marketplace-screenshot",
      title: "2012 Mazda3 s Touring",
      description:
        "2012 Mazda3, clean title, 130k miles. AC doesn't blow cold, needs struts, check engine light on (oxygen sensor). Small oil leak. Priced to sell at $6,800.",
      price: 6800,
      mileage: 130000,
      location: "Philadelphia, PA",
      vin: "JM1BL1V6XC1805234",
      year: 2012,
      make: "mazda",
      model: "Mazda3",
      trim: "TOURING",
      sellerName: "Chris",
      sellerType: "private",
    },
    kbbGood: 10500,
  },
  {
    // HIGH RISK: scam patterns + no VIN
    raw: {
      sourceId: "facebook-marketplace-manual",
      sourceKind: "marketplace-screenshot",
      title: "2015 VW Passat SEL Premium",
      description:
        "Selling my 2015 Passat SEL. $5,500 ONLY today, must sell ASAP, moving tomorrow. Car is in excellent condition. I'm currently overseas on military deployment, will ship the car to you after a deposit to hold it. Payment via zelle only.",
      price: 5500,
      mileage: 88000,
      location: "Out of state",
      year: 2015,
      make: "volkswagen",
      model: "Passat",
      trim: "SEL",
      sellerName: "unknown",
      sellerType: "private",
    },
    kbbGood: 13500,
  },
  {
    // REJECT (hard): salvage brand from history check
    raw: {
      sourceId: "inventory-api-mock",
      sourceKind: "inventory-api",
      title: "2013 Ford Fusion SE — rebuilt",
      description:
        "2013 Ford Fusion SE. Was salvage, professionally rebuilt after front damage. Runs well, 112k miles. $7,400.",
      price: 7400,
      mileage: 112000,
      location: "Trenton, NJ",
      vin: "3FA6P0HD9DR235791",
      year: 2013,
      make: "ford",
      model: "Fusion",
      trim: "SE",
      sellerType: "dealer",
    },
    kbbGood: 12500,
  },
];

async function main() {
  const config = loadConfig();
  console.log("Seeding DealHound ...");

  // Default profile
  const profiles = await listProfiles();
  let profileId = profiles[0]?.id;
  if (!profileId) {
    const created = await createProfile({
      name: "NJ/PA commuter cars — ≤70% of KBB Good",
      zip: "08054",
      radiusMiles: 100,
      make: null,
      model: null,
      trim: null,
      yearMin: 2010,
      yearMax: 2018,
      mileageMax: 160000,
      priceMin: 3000,
      priceMax: 15000,
      maxAskingRatio: config.gateARatio,
      maxAllInRatio: config.gateBRatio,
      requireCleanTitle: true,
      requireRepairEvidence: true,
      allowedRepairCategories: [],
      rejectedRepairCategories: ["ENGINE_MAJOR", "TRANSMISSION_MAJOR", "RUST_FRAME_FLOOD_FIRE"],
      maxExpectedRepairs: 4000,
      minDealMargin: 2500,
      maxFraudRiskScore: 40,
      active: true,
    });
    profileId = created.id;
    console.log(`Created profile: ${created.name}`);
  } else {
    console.log("Profile already present, skipping profile seed.");
  }

  for (const seed of SEED_LISTINGS) {
    const normalized = normalizeListing(seed.raw);
    const { listing, created } = await upsertListing(normalized);
    if (!created) {
      console.log(`↺ ${listing.title} already seeded`);
      continue;
    }

    await addValuation(listing.id!, {
      provider: "manual-kbb-entry",
      referenceGoodValue: seed.kbbGood,
      compMedian: null,
      compRange: null,
      confidence: 0.85,
      notes: "Seeded manual KBB Good-condition entry",
      computedAt: new Date().toISOString(),
    });

    if (listing.vin) {
      const brands = listing.description?.toLowerCase().includes("salvage") ? ["SALVAGE"] : [];
      const check = seedHistoryCheck(listing.vin, brands);
      await addHistoryCheck(listing.id!, check);
    }

    const result = await evaluateAndStore(listing.id!);
    console.log(
      `✓ ${listing.title}: score ${result.evaluation.score.total} (${result.evaluation.score.scoreClass})` +
        `${result.alertCreated ? " 🔔 ALERT" : ""}${result.evaluation.hardRejected ? " ⛔ HARD-REJECT" : ""}`,
    );
  }

  console.log("Seed complete.");
}

main().then(() => process.exit(0)).catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
