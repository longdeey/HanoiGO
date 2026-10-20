import type { APIRequestContext, Page } from "@playwright/test";

const API = "http://localhost:8000/api/v1";

/** A new account for one test: its session token and user, as the API returns them. */
export async function createAccount(request: APIRequestContext): Promise<{ token: string; user: unknown }> {
  const response = await request.post(`${API}/auth/register`, { data: {
    displayName: "Khách thử", password: "e2e-password",
    identifier: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  } });
  if (!response.ok()) throw new Error(`register failed: ${response.status()} ${await response.text()}`);
  return await response.json() as { token: string; user: unknown };
}

/** Every page of this test opens already signed in to the account. */
export async function signInPage(page: Page, account: { token: string; user: unknown }): Promise<void> {
  await page.addInitScript(([token, user]) => {
    window.localStorage.setItem("hanoigo-auth-token", token as string);
    window.localStorage.setItem("hanoigo-auth-user", JSON.stringify(user));
  }, [account.token, account.user] as const);
}

/** A signed-in browser: registers an account and signs every page of this test in. Returns the token. */
export async function signIn(page: Page, request: APIRequestContext): Promise<string> {
  const account = await createAccount(request);
  await signInPage(page, account);
  return account.token;
}
