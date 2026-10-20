// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loginAccount } from "@/services/api";
import { renderApp } from "@/test/render";
import { AccountPage } from "./AccountPage";

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  loginAccount: vi.fn(),
  fetchMyTrips: vi.fn().mockResolvedValue([]),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); window.localStorage.clear(); });

async function signInThroughTheForm() {
  const user = userEvent.setup();
  vi.mocked(loginAccount).mockResolvedValue({ token: "t", user: { id: "u", displayName: "Lan", email: "lan@example.com", phone: null } });
  renderApp(<AccountPage />);
  await user.type(screen.getByLabelText("Email hoặc số điện thoại"), "lan@example.com");
  await user.type(screen.getByLabelText("Mật khẩu"), "secret-pass");
  await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

describe("account page", () => {
  it("returns to the page that asked for an account once signed in", async () => {
    window.history.replaceState(null, "", `/account?next=${encodeURIComponent("/plan?step=1&days=4")}`);
    await signInThroughTheForm();
    expect(screen.queryByText(/Đăng nhập hoặc tạo tài khoản để tiếp tục/)).toBeNull();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/plan?step=1&days=4"));
  });

  it("stays on the page after a plain sign-in, and never follows a link to another site", async () => {
    window.history.replaceState(null, "", "/account?next=//evil.example.com");
    await signInThroughTheForm();
    expect(await screen.findByText("Lan")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
