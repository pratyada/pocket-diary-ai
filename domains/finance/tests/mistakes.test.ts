import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../src/db.js";
import { logMistake, listMistakes, analyzeMistakePatterns } from "../src/handlers/mistakes.js";
import type Database from "better-sqlite3";

let db: Database.Database;

beforeEach(() => {
  db = getTestDb();
});

describe("mistake_journal", () => {
  it("logs a mistake and retrieves it", () => {
    const entry = logMistake(db, {
      date: "2026-03-15",
      ticker: "TSLA",
      action: "Bought at peak after Elon tweet hype",
      amount: { amount: 5000, currency: "USD" },
      loss_realized: { amount: 1200, currency: "USD" },
      lesson: "Never buy on social media hype without checking fundamentals",
      category: "fomo",
      would_do_differently: "Wait 48 hours, check P/E, set a limit order below market",
      tags: ["tesla", "social-media"],
    });

    expect(entry.id).toMatch(/^mistake:/);

    const list = listMistakes(db);
    expect(list.length).toBe(1);
    expect(list[0]!.ticker).toBe("TSLA");
    expect(list[0]!.category).toBe("fomo");
  });

  it("filters by category", () => {
    logMistake(db, {
      date: "2026-01-10",
      ticker: "GME",
      action: "FOMO buy during meme rally",
      lesson: "Meme stocks are not investments",
      category: "fomo",
      would_do_differently: "Stick to index funds",
      tags: [],
    });

    logMistake(db, {
      date: "2026-02-20",
      ticker: "AAPL",
      action: "Panic sold during market dip",
      lesson: "Market dips are buying opportunities for quality stocks",
      category: "panic_sell",
      would_do_differently: "Hold and even buy more if fundamentals unchanged",
      tags: [],
    });

    const fomoOnly = listMistakes(db, { category: "fomo" });
    expect(fomoOnly.length).toBe(1);
    expect(fomoOnly[0]!.ticker).toBe("GME");
  });

  it("analyzes patterns across mistakes", () => {
    // Log multiple FOMO mistakes
    logMistake(db, {
      date: "2026-01-10",
      ticker: "GME",
      action: "FOMO buy",
      loss_realized: { amount: 500, currency: "CAD" },
      lesson: "Don't chase",
      category: "fomo",
      would_do_differently: "Wait",
      tags: [],
    });
    logMistake(db, {
      date: "2026-03-15",
      ticker: "TSLA",
      action: "FOMO buy on tweet",
      loss_realized: { amount: 1200, currency: "USD" },
      lesson: "No social media trades",
      category: "fomo",
      would_do_differently: "48h rule",
      tags: [],
    });

    const { patterns } = analyzeMistakePatterns(db);
    expect(patterns.length).toBe(1);
    expect(patterns[0]!.category).toBe("fomo");
    expect(patterns[0]!.occurrence_count).toBe(2);
    expect(patterns[0]!.total_loss).toBeGreaterThan(0);
    expect(patterns[0]!.recommendation).toContain("cooling period");
  });
});
