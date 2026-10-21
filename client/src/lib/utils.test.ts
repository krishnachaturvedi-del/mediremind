import { describe, expect, it } from "vitest";
import {
  FREQUENCY_LABELS,
  formatTime12,
  relativeTime,
  shiftDateKey,
  statusMeta,
  todayKey,
} from "./utils";

describe("formatTime12", () => {
  it("formats morning times", () => {
    expect(formatTime12("08:05")).toBe("8:05 AM");
  });

  it("formats afternoon times", () => {
    expect(formatTime12("13:30")).toBe("1:30 PM");
  });

  it("treats midnight as 12 AM", () => {
    expect(formatTime12("00:00")).toBe("12:00 AM");
  });

  it("treats noon as 12 PM", () => {
    expect(formatTime12("12:00")).toBe("12:00 PM");
  });
});

describe("shiftDateKey", () => {
  it("shifts backwards across month boundaries", () => {
    expect(shiftDateKey("2026-03-02", -2)).toBe("2026-02-28");
  });

  it("shifts forwards across month boundaries", () => {
    expect(shiftDateKey("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("returns the same date for zero days", () => {
    expect(shiftDateKey("2026-06-15", 0)).toBe("2026-06-15");
  });

  it("is reversible", () => {
    expect(shiftDateKey(shiftDateKey("2026-10-21", -5), 5)).toBe("2026-10-21");
  });
});

describe("todayKey", () => {
  it("produces a zero-padded ISO-like date", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("statusMeta", () => {
  it("returns known metadata for known statuses", () => {
    expect(statusMeta("IN_STOCK").label).toBe("In stock");
    expect(statusMeta("REFILL_REQUIRED").label).toBe("Refill required");
    expect(statusMeta("COMPLETED").label).toBe("Completed");
  });

  it("falls back gracefully for unknown statuses", () => {
    expect(statusMeta("SOMETHING_NEW").label).toBe("SOMETHING_NEW");
    expect(statusMeta("SOMETHING_NEW").classes).toContain("bg-slate-100");
  });
});

describe("relativeTime", () => {
  it("describes very recent times", () => {
    expect(relativeTime(new Date(Date.now() - 5_000))).toBe("just now");
  });

  it("describes past minutes", () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60_000))).toBe("5 min ago");
  });

  it("describes future times", () => {
    expect(relativeTime(new Date(Date.now() + 2 * 3_600_000))).toBe("in 2h");
  });
});

describe("FREQUENCY_LABELS", () => {
  it("covers every frequency the API accepts", () => {
    for (const f of ["ONCE_DAILY", "TWICE_DAILY", "THREE_TIMES_DAILY", "FOUR_TIMES_DAILY", "CUSTOM"]) {
      expect(FREQUENCY_LABELS[f]).toBeTruthy();
    }
  });
});
