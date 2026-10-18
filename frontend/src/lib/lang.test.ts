import { describe, expect, it } from "vitest";

import { nameLang } from "./lang";

describe("nameLang", () => {
  it("marks Vietnamese names only in the English interface", () => {
    expect(nameLang("Đền Bạch Mã", "en")).toBe("vi");
    expect(nameLang("Phố cổ", "en")).toBe("vi");
    expect(nameLang("Temple of Literature", "en")).toBeUndefined();
    expect(nameLang("Đền Bạch Mã", "vi")).toBeUndefined();
    expect(nameLang(null, "en")).toBeUndefined();
  });
});
