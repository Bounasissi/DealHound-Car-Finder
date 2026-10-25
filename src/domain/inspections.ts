export const DEFAULT_INSPECTION_ITEMS = [
  { code: "VIN_MATCH", label: "VIN matches dashboard and title" },
  { code: "SELLER_TITLE", label: "Seller matches title" },
  { code: "COLD_START", label: "Cold start" },
  { code: "WARNING_LIGHTS", label: "Warning lights" },
  { code: "OBD_CODES", label: "OBD codes" },
  { code: "OIL_COOLANT", label: "Oil and coolant condition" },
  { code: "LEAKS", label: "Leaks" },
  { code: "TRANSMISSION", label: "Transmission" },
  { code: "BRAKES", label: "Braking" },
  { code: "STEERING_SUSPENSION", label: "Steering and suspension" },
  { code: "TIRES", label: "Tires" },
  { code: "RUST", label: "Rust" },
  { code: "FRAME", label: "Frame" },
  { code: "HVAC", label: "HVAC" },
  { code: "ELECTRONICS", label: "Electronics" },
  { code: "ROAD_TEST", label: "Road test" },
] as const;

export type InspectionResult = "PASS" | "FAIL" | "UNKNOWN" | "NOT_CHECKED";
export interface InspectionItemState { code: string; result: InspectionResult; note?: string | null; }

export function inspectionSummary(items: Array<{ code: string; result: InspectionResult }>) {
  const passed = items.filter((item) => item.result === "PASS").length;
  const failed = items.filter((item) => item.result === "FAIL").length;
  const unknown = items.filter((item) => item.result === "UNKNOWN" || item.result === "NOT_CHECKED").length;
  return { passed, failed, unknown, complete: items.length === DEFAULT_INSPECTION_ITEMS.length && unknown === 0 };
}
