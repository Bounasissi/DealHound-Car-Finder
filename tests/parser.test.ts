import { describe, expect, it } from "vitest";
import { parseListingText } from "@/lib/parser";

describe("parseListingText", () => {
  it("parses a realistic marketplace paste", () => {
    const p = parseListingText(
      "2013 Honda Accord EX-L\n$10,500\n115k miles\nClean title in hand\nSelling my daily driver. Needs new tires soon and AC doesn't blow cold. Small dent on rear quarter panel.\nLocated in Cherry Hill, NJ",
    );
    expect(p.price).toBe(10500);
    expect(p.mileage).toBe(115000);
    expect(p.year).toBe(2013);
    expect(p.make).toBe("honda");
    expect(p.model).toBe("Accord");
    expect(p.trim).toBe("EX");
    expect(p.location).toBe("Cherry Hill, NJ");
  });

  it("handles 'asking' phrasing and k-mileage shorthand", () => {
    const p = parseListingText("Asking 8500 obo. Only 87k original miles.");
    expect(p.price).toBe(8500);
    expect(p.mileage).toBe(87000);
  });

  it("normalizes make aliases", () => {
    expect(parseListingText("2015 Chevy Silverado 1500 LT").make).toBe("chevrolet");
    expect(parseListingText("Mercedes C300 for sale").make).toBe("mercedes-benz");
  });

  it("returns nulls when fields absent", () => {
    const p = parseListingText("call me about the car");
    expect(p.price).toBeNull();
    expect(p.mileage).toBeNull();
    expect(p.year).toBeNull();
    expect(p.make).toBeNull();
  });

  it("does not confuse prices with years", () => {
    const p = parseListingText("2016 model, $9,500");
    expect(p.year).toBe(2016);
    expect(p.price).toBe(9500);
  });
});
