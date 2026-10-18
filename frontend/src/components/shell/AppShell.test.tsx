// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "@/test/render";
import { todayInHanoi } from "@/lib/format";
import { AppShell } from "./AppShell";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, back: navigation.back, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => { cleanup(); navigation.pathname = "/"; window.localStorage.clear(); document.cookie = "hanoigo-language=; max-age=0"; });

describe("app shell", () => {
  it("offers the five destinations and marks the open one", () => {
    navigation.pathname = "/stories";
    renderApp(<AppShell><p>content</p></AppShell>);
    const [bottom] = screen.getAllByRole("navigation", { name: "Điều hướng chính" }).filter((nav) => nav.querySelector("ul"));
    const links = within(bottom).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Trang chủ", "Chuyện Hà Nội", "Lập lịch", "Lễ hội", "Chuyến đi"]);
    expect(within(bottom).getByRole("link", { name: "Chuyện Hà Nội" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Bỏ qua tới nội dung chính" }).getAttribute("href")).toBe("#main");
  });

  it("shows a red dot on Trips when a saved trip covers today", () => {
    window.localStorage.setItem("hanoigo-owner-t1", "token");
    window.localStorage.setItem("hanoigo-trip-summary-t1", JSON.stringify({ tripId: "t1", startDate: todayInHanoi(), days: 2, travelerCount: 2, budgetTotal: 1, startName: null, createdAt: "" }));
    renderApp(<AppShell><p>content</p></AppShell>);
    expect(screen.getByText("Có chuyến hôm nay")).toBeTruthy();
  });

  it("hides both bars while planning", () => {
    navigation.pathname = "/plan";
    renderApp(<AppShell><p>form</p></AppShell>);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("form")).toBeTruthy();
  });

  it("switches the interface language from the top bar", async () => {
    const user = userEvent.setup();
    renderApp(<AppShell><p>content</p></AppShell>);
    await user.click(screen.getByRole("button", { name: "Đổi ngôn ngữ sang English" }));
    expect(screen.getAllByRole("link", { name: "Stories" }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("en");
    expect(document.cookie).toContain("hanoigo-language=en");
  });
});
