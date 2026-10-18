import { describe, expect, it } from "vitest";

import { addDays, formatDateRange, formatDayLong, formatDayShort, formatDuration, formatKm, formatMoney, formatMonth, sentence } from "./format";

describe("formatting (spec §6.2)", () => {
  it("writes money as 'đ' in Vietnamese and 'VND' in English", () => {
    expect(formatMoney(2_850_000, "vi")).toBe("2.850.000 đ");
    expect(formatMoney(2_850_000, "en")).toBe("2,850,000 VND");
  });

  it("uses the local decimal separator for distances", () => {
    expect(formatKm(3.4, "vi")).toBe("3,4 km");
    expect(formatKm(3.4, "en")).toBe("3.4 km");
  });

  it("spells durations out", () => {
    expect(formatDuration(90, "vi")).toBe("1 giờ 30 phút");
    expect(formatDuration(90, "en")).toBe("1 h 30 min");
    expect(formatDuration(45, "vi")).toBe("45 phút");
    expect(formatDuration(120, "en")).toBe("2 h");
  });

  it("formats dates without time-zone drift", () => {
    expect(formatDayLong("2026-10-18", "vi")).toBe("Chủ Nhật, 18/10");
    expect(formatDayLong("2026-10-18", "en")).toBe("Sun 18 Oct");
    expect(formatDayShort("2026-10-19", "vi")).toBe("T2 19/10");
    expect(formatDateRange("2026-10-18", "2026-10-20", "vi")).toBe("18–20/10");
    expect(formatDateRange("2026-10-30", "2026-11-02", "en")).toBe("30 Oct – 2 Nov");
    expect(formatMonth("2026-10-01", "vi")).toBe("Tháng 10");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("uses sentence case, not title case", () => {
    expect(sentence("lịch sử")).toBe("Lịch sử");
    expect(sentence("")).toBe("");
  });
});
