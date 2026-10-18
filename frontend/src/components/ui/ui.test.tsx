// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { option, renderApp } from "@/test/render";
import { BudgetMeter, MiniRoute } from "@/components/trip/Meters";
import { drawRoute } from "@/components/map/RouteMap";
import { MoneyInput } from "./Controls";
import { Sheet } from "./Sheet";

afterEach(cleanup);

function Money({ language }: { language: "vi" | "en" }) {
  const [value, setValue] = useState(3_000_000);
  return <><label htmlFor="m">Budget</label><MoneyInput id="m" value={value} onChange={setValue} language={language} /><output>{value}</output></>;
}

describe("MoneyInput", () => {
  it("groups digits per language and keeps only digits", async () => {
    const user = userEvent.setup();
    renderApp(<Money language="vi" />);
    const input = screen.getByLabelText("Budget") as HTMLInputElement;
    expect(input.value).toBe("3.000.000");
    expect(screen.getByText("đ")).toBeTruthy();
    await user.clear(input);
    await user.type(input, "12a500000");
    await user.tab();
    expect(screen.getByRole("status").textContent).toBe("12500000");
    expect(input.value).toBe("12.500.000");
    cleanup();
    renderApp(<Money language="en" />, { language: "en" });
    expect((screen.getByLabelText("Budget") as HTMLInputElement).value).toBe("3,000,000");
    expect(screen.getByText("VND")).toBeTruthy();
  });
});

describe("BudgetMeter and MiniRoute", () => {
  it("states the share in words, not only as a bar", () => {
    renderApp(<BudgetMeter option={option("BEST_MATCH", "best")} />);
    expect(screen.getByText("95% ngân sách")).toBeTruthy();
  });

  it("draws one station per stop for each day", () => {
    renderApp(<MiniRoute option={option("BEST_MATCH", "best")} />);
    expect(screen.getByText(/2 điểm/)).toBeTruthy();
    expect(document.querySelectorAll("circle")).toHaveLength(2);
  });
});

describe("drawRoute", () => {
  it("does not animate when motion is reduced", () => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path") as SVGPathElement;
    const getTotalLength = vi.fn(() => 100);
    Object.assign(path, { getTotalLength });
    drawRoute({ getElement: () => path } as never, true, false);
    expect(getTotalLength).not.toHaveBeenCalled();
    expect(path.style.strokeDashoffset).toBe("");
    drawRoute({ getElement: () => path } as never, false, false);
    expect(path.style.strokeDashoffset).toBe("0");
  });
});

describe("MoneyInput editing", () => {
  it("replaces the whole amount after select-all", async () => {
    const user = userEvent.setup();
    renderApp(<Money language="vi" />);
    const input = screen.getByLabelText("Budget") as HTMLInputElement;
    await user.click(input);
    expect(input.value).toBe("3.000.000");
    input.setSelectionRange(0, input.value.length);
    await user.keyboard("10000000");
    expect(screen.getByRole("status").textContent).toBe("10000000");
    expect(input.value).toBe("10.000.000");
  });
});

function TwoSheets() {
  const [open, setOpen] = useState<"a" | "b" | null>("a");
  return <>
    <Sheet open={open === "a"} onClose={() => setOpen(null)} title="Stop">
      <button type="button" onClick={() => setOpen("b")}>Replace</button>
    </Sheet>
    <Sheet open={open === "b"} onClose={() => setOpen(null)} title="Replace place">
      <button type="button">Confirm</button>
    </Sheet>
  </>;
}

describe("Sheet handoff", () => {
  it("leaves one dialog, keeps focus in the new sheet and unlocks scrolling at the end", async () => {
    const user = userEvent.setup();
    renderApp(<TwoSheets />);
    await user.click(await screen.findByRole("button", { name: "Replace" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const replace = screen.getByRole("dialog", { name: "Replace place" });
    await waitFor(() => expect(replace.contains(document.activeElement)).toBe(true));
    await waitFor(() => expect(screen.queryByText("Stop")).toBeNull());
    expect(replace.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });
});
