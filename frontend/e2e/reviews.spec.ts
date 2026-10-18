import { expect, test } from "@playwright/test";

// Spec §8.8 and §14: writing a review while signed out signs in right there,
// then returns to the review form. Account and review calls are answered
// here, so the run leaves no test accounts or reviews in the database.
test("writing a review while signed out", async ({ page, request }) => {
  const story = await (await request.get("http://localhost:8000/api/v1/stories/van-mieu-quoc-tu-giam?language=vi")).json() as { place: { id: string } };
  const placeId = story.place.id;
  const place = await (await request.get(`http://localhost:8000/api/v1/places/${placeId}?language=vi`)).json() as {
    ratingAverage?: number; ratingCount?: number; comments?: unknown[];
  };

  let registered: { displayName: string; identifier: string } | null = null;
  await page.route("**/api/v1/auth/register", async (route) => {
    registered = route.request().postDataJSON() as { displayName: string; identifier: string };
    await route.fulfill({ json: { token: "e2e-token", user: { id: "e2e-user", displayName: registered.displayName, email: registered.identifier, phone: null } } });
  });
  let posted: { rating: number; comment: string } | null = null;
  await page.route(`**/api/v1/places/${placeId}/reviews`, async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer e2e-token");
    posted = route.request().postDataJSON() as { rating: number; comment: string };
    const count = (place.ratingCount ?? 0) + 1;
    const average = ((place.ratingAverage ?? 0) * (count - 1) + posted.rating) / count;
    await route.fulfill({ json: {
      ...place, ratingCount: count, ratingAverage: Math.round(average * 10) / 10,
      comments: [{ id: "e2e-review", authorName: "Lan", rating: posted.rating, comment: posted.comment, createdAt: new Date().toISOString() }, ...(place.comments ?? [])],
    } });
  });

  await page.goto(`/places/${placeId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Viết đánh giá" }).click();
  const signIn = page.getByRole("dialog", { name: "Đăng nhập để viết đánh giá" });
  await signIn.getByRole("tab", { name: "Đăng ký" }).click();
  await signIn.getByLabel("Tên hiển thị").fill("Lan");
  await signIn.getByLabel("Email hoặc số điện thoại").fill("lan@example.com");
  await signIn.getByLabel("Mật khẩu").fill("hanoi-2026");
  await signIn.getByRole("button", { name: "Tạo tài khoản" }).click();

  // Back on the page, straight in the review form, posting under the new name.
  await expect(signIn).toHaveCount(0);
  expect(registered).toEqual(expect.objectContaining({ displayName: "Lan", identifier: "lan@example.com" }));
  await expect(page.getByText("Đang đăng với tên Lan")).toBeVisible();
  await page.getByRole("radio", { name: "4 sao" }).check({ force: true });
  await page.getByLabel("Nhận xét").fill("Sân Thái Học yên tĩnh vào buổi sáng.");
  await page.getByRole("button", { name: "Gửi đánh giá" }).click();

  await expect(page.getByText("Đã gửi đánh giá")).toBeVisible();
  expect(posted).toEqual({ rating: 4, comment: "Sân Thái Học yên tĩnh vào buổi sáng." });
  await expect(page.getByText("Sân Thái Học yên tĩnh vào buổi sáng.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Viết đánh giá" })).toBeVisible();
});
