test("User can type goal hours smoothly without cursor jumping", async ({ page }) => {
  await page.goto("/settings");
  const dailyInput = page.locator('[data-goal-id="daily-goal-input"]');
  await dailyInput.click();
  await dailyInput.fill("");
  await dailyInput.type("2.5");
  expect(await dailyInput.inputValue()).toBe("2.5");
  // Check cursor position via JS
  const cursorPos = await dailyInput.evaluate((el: HTMLInputElement) => el.selectionStart);
  expect(cursorPos).toBe(3); // End of "2.5"
});

test("User can click subject and view all tasks", async ({ page }) => {
  await page.goto("/subjects");
  await page.locator(".subject-card").first().click();
  await expect(page.locator("text=Short-Term Tasks").or(page.locator("text=Other Tasks"))).toBeVisible();
  // Subject Tasks (Legacy) must NOT appear
  await expect(page.locator("text=Subject Tasks (Legacy)")).not.toBeVisible();
});

test("Progress bar is always visible in subject detail", async ({ page }) => {
  await page.goto("/subjects");
  await page.locator(".subject-card").first().click();
  // Progress bar track must always be in DOM
  await expect(page.locator(".rounded-full.bg-secondary\/40")).toBeVisible();
});
