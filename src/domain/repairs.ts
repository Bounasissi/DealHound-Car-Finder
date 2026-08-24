/**
 * Repair intelligence: taxonomy, heuristic text extraction, cost estimation.
 * Estimates are planning-grade ranges (low/expected/high) that inspections confirm.
 */
import type {
  ParsedIssueRef,
  RepairCategory,
  RepairEstimateSummary,
  RepairIssue,
  Severity,
  VehicleAttributes,
} from "./types";

export interface CategorySpec {
  category: RepairCategory;
  label: string;
  /** Base expected cost at MODERATE severity for a mainstream vehicle. */
  baseCost: number;
  lowFactor: number; // multiplier for low estimate
  highFactor: number; // multiplier for high estimate
  severityFactors: Record<Severity, number>;
  majorRiskDefault: boolean;
  /** Patterns that indicate this issue in listing/seller text. */
  patterns: RegExp[];
}

/** Cost model tuned for private-party mainstream vehicles (USD). Documented defaults. */
export const REPAIR_TAXONOMY: CategorySpec[] = [
  {
    category: "COSMETIC", label: "Cosmetic (paint, dents, interior)",
    baseCost: 450, lowFactor: 0.4, highFactor: 2.2,
    severityFactors: { LOW: 0.5, MODERATE: 1, HIGH: 1.8, CRITICAL: 3 },
    majorRiskDefault: false,
    patterns: [
      /\b(dent|dings?|scratches?|scuffs?|clear\s*coat|peeling\s+paint|repaint|faded\s+paint|curb\s+rash|hail\s+damage|torn\s+(seat|upholstery)|interior\s+wear)\b/i,
    ],
  },
  {
    category: "TIRES_BRAKES", label: "Tires & brakes",
    baseCost: 700, lowFactor: 0.5, highFactor: 1.6,
    severityFactors: { LOW: 0.35, MODERATE: 1, HIGH: 1.5, CRITICAL: 2 },
    majorRiskDefault: false,
    patterns: [
      /\b(new\s+)?tires?\b/i, /\bbrakes?(?:\s+(pads|rotors?))?\b/i, /\bbald\b/i, /\brotors?\b/i,
      /\bcaliper\b/i, /\babs?\s+light\b/i, /\bneeds?\s+tires\b/i,
    ],
  },
  {
    category: "SUSPENSION", label: "Suspension & steering",
    baseCost: 850, lowFactor: 0.45, highFactor: 2.0,
    severityFactors: { LOW: 0.4, MODERATE: 1, HIGH: 1.9, CRITICAL: 3 },
    majorRiskDefault: false,
    patterns: [
      /\b(struts?|shocks?|control\s+arms?|ball\s+joints?|tie\s+rods?|sway\s+bar|bushings?|alignment|pulls?\s+(to\s+the\s+)?(left|right)|clunk(s|ing)?\s+over\s+bumps?)\b/i,
    ],
  },
  {
    category: "BATTERY_STARTING_CHARGING", label: "Battery / starting / charging",
    baseCost: 320, lowFactor: 0.4, highFactor: 2.4,
    severityFactors: { LOW: 0.4, MODERATE: 1, HIGH: 2.0, CRITICAL: 3 },
    majorRiskDefault: false,
    patterns: [
      /\b(battery|alternator|starter|slow\s+crank|doesn'?t\s+(start|crank)|jump[- ]?start|charging\s+(system|issue)|parasitic\s+draw)\b/i,
    ],
  },
  {
    category: "BEARINGS_EXHAUST", label: "Bearings & exhaust",
    baseCost: 550, lowFactor: 0.45, highFactor: 2.0,
    severityFactors: { LOW: 0.4, MODERATE: 1, HIGH: 1.8, CRITICAL: 2.6 },
    majorRiskDefault: false,
    patterns: [
      /\b(wheel\s+bearings?|humming\s+(noise|sound)|grinding\s+noise|exhaust|muffler|catalytic\s+converter|flex\s+pipe|rattles?\s+underneath)\b/i,
    ],
  },
  {
    category: "HVAC", label: "A/C & heating",
    baseCost: 900, lowFactor: 0.3, highFactor: 2.2,
    severityFactors: { LOW: 0.25, MODERATE: 1, HIGH: 1.9, CRITICAL: 2.6 },
    majorRiskDefault: false,
    patterns: [
      /\b(a\/?c|air\s+condition(ing|er)?|blows?\s+(hot|warm)\s+air|compressor|refrigerant|freon|r-?134a|heater\s+core|no\s+heat)\b/i,
    ],
  },
  {
    category: "ELECTRICAL_SENSORS", label: "Electrical & sensors",
    baseCost: 480, lowFactor: 0.35, highFactor: 2.4,
    severityFactors: { LOW: 0.35, MODERATE: 1, HIGH: 2.0, CRITICAL: 3 },
    majorRiskDefault: false,
    patterns: [
      /\b(check\s+engine\s+light|cel|warning\s+lights?|sensor|window\s+(regulator|motor|won'?t\s+go\s+up)|power\s+window|radio|dashboard\s+lights?|electrical\s+(gremlin|issue|problem)|wiring)\b/i,
    ],
  },
  {
    category: "LEAKS_MISFIRES", label: "Leaks & misfires",
    baseCost: 750, lowFactor: 0.4, highFactor: 2.4,
    severityFactors: { LOW: 0.35, MODERATE: 1, HIGH: 2.0, CRITICAL: 3 },
    majorRiskDefault: false,
    patterns: [
      /\b(oil\s+leak|coolant\s+leak|trans(f|mission)?\s+fluid\s+leak|power\s+steering\s+leak|valve\s+cover\s+gasket|main\s+seal|misfire|rough\s+idle|spark\s+plugs?|coil\s+pack|head\s+gasket)\b/i,
    ],
  },
  {
    category: "ENGINE_MAJOR", label: "Engine (major mechanical)",
    baseCost: 5200, lowFactor: 0.5, highFactor: 1.8,
    severityFactors: { LOW: 0.3, MODERATE: 1, HIGH: 1.4, CRITICAL: 1.8 },
    majorRiskDefault: true,
    patterns: [
      /\b(engine\s+(rebuild|replacement|swap|blew|blown|knocking|failed)|needs?\s+(a\s+)?new\s+engine|rod\s+knock|timing\s+(belt|chain)\s+(job|replace)|seized\s+engine|smoke(s|ing)?\s+(from\s+)?(engine|exhaust))\b/i,
    ],
  },
  {
    category: "TRANSMISSION_MAJOR", label: "Transmission (major mechanical)",
    baseCost: 4300, lowFactor: 0.5, highFactor: 1.8,
    severityFactors: { LOW: 0.3, MODERATE: 1, HIGH: 1.4, CRITICAL: 1.8 },
    majorRiskDefault: true,
    patterns: [
      /\b(transmission\s+(rebuild|replace(ment)?|slipping|failed|problems?|issues?)|needs?\s+(a\s+)?new\s+transmission|won'?t\s+shift|gear\s+slipping|clutch\s+replace(ment)?)\b/i,
    ],
  },
  {
    category: "RUST_FRAME_FLOOD_FIRE", label: "Rust / frame / flood / fire",
    baseCost: 3800, lowFactor: 0.4, highFactor: 2.0,
    severityFactors: { LOW: 0.25, MODERATE: 1, HIGH: 1.6, CRITICAL: 2.2 },
    majorRiskDefault: true,
    patterns: [
      /\b(rust(ed|-y)?|frame\s+(damage|rust|repair)|subframe|rockers?\s+rust|floor\s+pans?|flood\s+damage|water\s+intrusion|fire\s+damage|burned)\b/i,
    ],
  },
  {
    category: "OTHER_MAINTENANCE", label: "Scheduled maintenance / other",
    baseCost: 350, lowFactor: 0.4, highFactor: 2.0,
    severityFactors: { LOW: 0.4, MODERATE: 1, HIGH: 1.7, CRITICAL: 2.4 },
    majorRiskDefault: false,
    patterns: [
      /\b(oil\s+change|tune[- ]?up|filters?|fluids?\s+(flush|change)|scheduled\s+maintenance|serpentine\s+belt|wipers?)\b/i,
    ],
  },
];

const SPEC_BY_CATEGORY = new Map(REPAIR_TAXONOMY.map((s) => [s.category, s]));

export function specFor(category: RepairCategory): CategorySpec {
  const spec = SPEC_BY_CATEGORY.get(category);
  if (!spec) throw new Error(`Unknown repair category: ${category}`);
  return spec;
}

let issueSeq = 0;
function nextIssueId(): string {
  issueSeq += 1;
  return `iss_${Date.now().toString(36)}_${issueSeq}`;
}

/** Estimate cost range for one issue from the taxonomy model. */
export function estimateIssue(
  category: RepairCategory,
  severity: Severity,
  opts: { confidence?: number; description?: string; source?: RepairIssue["source"]; majorRiskOverride?: boolean } = {},
): RepairIssue {
  const spec = specFor(category);
  const scaled = spec.baseCost * spec.severityFactors[severity];
  return {
    id: nextIssueId(),
    category,
    description: opts.description ?? spec.label,
    severity,
    confidence: opts.confidence ?? 0.6,
    estimateLow: Math.round(scaled * spec.lowFactor),
    estimateExpected: Math.round(scaled),
    estimateHigh: Math.round(scaled * spec.highFactor),
    majorRisk: opts.majorRiskOverride ?? spec.majorRiskDefault,
    source: opts.source ?? "TEXT_PARSE",
  };
}

/**
 * Extract candidate issues from free text using taxonomy patterns.
 * Confidence is modest (parsed text is evidence, not inspection).
 */
export function parseIssuesFromText(text: string): ParsedIssueRef[] {
  if (!text) return [];
  const found: ParsedIssueRef[] = [];
  const seen = new Set<RepairCategory>();
  for (const spec of REPAIR_TAXONOMY) {
    for (const re of spec.patterns) {
      const m = text.match(re);
      if (m && !seen.has(spec.category)) {
        seen.add(spec.category);
        found.push({ category: spec.category, snippet: m[0], confidence: 0.55 });
        break;
      }
    }
  }
  return found;
}

/** Severity inference from language intensity around the mention. */
export function inferSeverity(snippetContext: string): Severity {
  const t = snippetContext.toLowerCase();
  if (/\b(blown|seized|failed|dead|totaled?|gone|shot|rebuild|replace(ment)?|new (engine|transmission))\b/.test(t))
    return "CRITICAL";
  if (/\b(leaks?|slipping|grinding|knocking|major|bad|won'?t)\b/.test(t)) return "HIGH";
  if (/\b(needs?|worn|slow|small|minor|soon)\b/.test(t)) return "MODERATE";
  return "LOW";
}

/** Luxury/performance and truck/SUV multipliers — crude but documented. */
export function vehicleCostMultiplier(vehicle: VehicleAttributes): number {
  let m = 1.0;
  const make = (vehicle.make ?? "").toLowerCase();
  if (["bmw", "mercedes-benz", "audi", "porsche", "land rover", "jaguar", "volvo"].includes(make)) m *= 1.45;
  else if (["lexus", "acura", "infiniti", "genesis", "cadillac", "lincoln"].includes(make)) m *= 1.25;
  if (["toyota", "honda", "mazda", "hyundai", "kia", "ford", "chevrolet", "nissan"].includes(make)) m *= 0.95;
  const body = (vehicle.bodyClass ?? "").toLowerCase();
  if (body.includes("truck") || body.includes("suv")) m *= 1.15;
  return m;
}

export interface BuildIssuesOptions {
  parsedRefs?: ParsedIssueRef[];
  userIssues?: RepairIssue[];
  vehicle?: VehicleAttributes;
  /** Full raw text per ref for severity inference. */
  fullText?: string;
}

/** Merge parsed refs + user-entered issues into a deduplicated issue list. */
export function buildIssues(opts: BuildIssuesOptions): RepairIssue[] {
  const byCategory = new Map<RepairCategory, RepairIssue>();
  const mult = opts.vehicle ? vehicleCostMultiplier(opts.vehicle) : 1;

  for (const ref of opts.parsedRefs ?? []) {
    const context = extractContext(opts.fullText ?? "", ref.snippet);
    const severity = inferSeverity(context);
    const issue = estimateIssue(ref.category, severity, {
      confidence: ref.confidence,
      description: `Detected in listing text: "${ref.snippet}"`,
      source: "TEXT_PARSE",
    });
    issue.estimateLow = Math.round(issue.estimateLow * mult);
    issue.estimateExpected = Math.round(issue.estimateExpected * mult);
    issue.estimateHigh = Math.round(issue.estimateHigh * mult);
    byCategory.set(ref.category, issue);
  }

  // User-entered/inspection issues override parsed ones for the same category.
  for (const ui of opts.userIssues ?? []) {
    byCategory.set(ui.category, ui);
  }
  return [...byCategory.values()];
}

function extractContext(text: string, snippet: string, radius = 60): string {
  const idx = text.toLowerCase().indexOf(snippet.toLowerCase());
  if (idx === -1) return snippet;
  return text.slice(Math.max(0, idx - radius), idx + snippet.length + radius);
}

export interface SummarizeOptions {
  rejectedCategories?: RepairCategory[];
  /** Optional allowlist. When non-empty, every other detected category is rejected. */
  allowedCategories?: RepairCategory[];
}

/** Aggregate issues into totals + rejection info against profile rules. */
export function summarizeRepairs(
  issues: RepairIssue[],
  opts: SummarizeOptions = {},
): RepairEstimateSummary {
  const rejectedSet = new Set(opts.rejectedCategories ?? []);
  const allowedSet = new Set(opts.allowedCategories ?? []);
  if (allowedSet.size > 0) {
    for (const issue of issues) if (!allowedSet.has(issue.category)) rejectedSet.add(issue.category);
  }
  const totalLow = Math.round(issues.reduce((s, i) => s + i.estimateLow, 0));
  const totalExpected = Math.round(issues.reduce((s, i) => s + i.estimateExpected, 0));
  const totalHigh = Math.round(issues.reduce((s, i) => s + i.estimateHigh, 0));
  return {
    issues,
    totalLow,
    totalExpected,
    totalHigh,
    hasMajorRisk: issues.some((i) => i.majorRisk),
    rejectedCategories: [...new Set(issues.filter((i) => rejectedSet.has(i.category)).map((i) => i.category))],
    unknownCosts: issues.length === 0,
    unknownReason: issues.length === 0 ? "No repair findings were disclosed or confirmed" : null,
  };
}
