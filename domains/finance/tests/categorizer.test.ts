import { describe, it, expect } from "vitest";
import { categorize, normalizeMerchant } from "../src/categorizer.js";

describe("normalizeMerchant", () => {
  it("lowercases and strips special chars", () => {
    expect(normalizeMerchant("STARBUCKS #1234")).toBe("starbucks_1234");
  });

  it("strips common POS prefixes", () => {
    expect(normalizeMerchant("POS Tim Hortons")).toBe("tim_hortons");
  });

  it("collapses whitespace to underscore", () => {
    expect(normalizeMerchant("Canadian  Tire   Store")).toBe("canadian_tire_store");
  });
});

describe("categorize", () => {
  it("exact matches known merchants", () => {
    const result = categorize("Costco");
    expect(result.category).toBe("groceries");
    expect(result.subcategory).toBe("bulk_store");
    expect(result.confidence).toBe(1.0);
    expect(result.source).toBe("rules");
  });

  it("partial matches work", () => {
    const result = categorize("STARBUCKS #4521 TORONTO");
    expect(result.category).toBe("dining");
    expect(result.subcategory).toBe("coffee");
    expect(result.confidence).toBe(0.85);
  });

  it("returns uncategorized for unknown merchants", () => {
    const result = categorize("XYZZY CORP UNUSUAL MERCHANT");
    expect(result.category).toBe("uncategorized");
    expect(result.confidence).toBe(0.0);
    expect(result.source).toBe("unknown");
  });

  it("handles Indian merchants", () => {
    const result = categorize("Swiggy");
    expect(result.category).toBe("dining");
    expect(result.subcategory).toBe("delivery");
  });

  it("handles subscription services", () => {
    const result = categorize("Netflix");
    expect(result.category).toBe("subscriptions");
    expect(result.subcategory).toBe("streaming");
  });
});
