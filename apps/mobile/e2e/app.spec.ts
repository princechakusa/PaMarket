// PaMarket app on Expo web — end-to-end smoke + feature tests.
// Read-only against the live Supabase project: nothing is signed in, posted
// or sent. Every test also fails on any uncaught page error.
import { expect, test, type Page } from "@playwright/test";

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  // Always start in English (language choice persists in localStorage).
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("e2e-lang-kept")) localStorage.removeItem("app-language-v1");
    } catch {}
  });
});

test.afterEach(() => {
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
});

async function openSearch(page: Page) {
  await page.goto("/search");
  await expect(page.getByText(/^\d+ ads$/)).toBeVisible();
  // Wait until the first page of results has rendered.
  await expect(page.getByText(/^≈ ZiG /).first()).toBeVisible();
}

test("home renders categories and bottom navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Browse Categories")).toBeVisible();
  for (const label of ["Property", "Vehicles", "Electronics", "Jobs"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  // Rendered uppercase via CSS; the DOM text is "Home", "Search", …
  for (const label of ["Home", "Search", "Post", "Messages", "Account"]) {
    await expect(page.getByText(new RegExp(`^${label}$`, "i")).first()).toBeVisible();
  }
});

test("search shows $ prices with a ZiG estimate, never the raw currency code", async ({ page }) => {
  await openSearch(page);
  await expect(page.getByText(/^\$[\d,]+/).first()).toBeVisible();
  await expect(page.getByText(/^USD\d/)).toHaveCount(0);
});

test("search tolerates a typo", async ({ page }) => {
  await openSearch(page);
  // Pick a real result title with a long-enough word and misspell it.
  const titles = await page.locator("text=/^≈ ZiG /").evaluateAll((els) =>
    els.map((el) => {
      const card = el.parentElement;
      return card ? Array.from(card.children).map((c) => c.textContent ?? "") : [];
    })
  );
  const words = titles
    .flat()
    .flatMap((t) => t.split(/[^A-Za-z]+/))
    .filter((w) => w.length >= 6 && !/^ZiG$/i.test(w));
  test.skip(!words.length, "no suitable listing titles to misspell");
  const word = words[0];
  const typo = word.slice(0, 2) + word.slice(3); // drop the 3rd letter
  await page.getByRole("textbox", { name: "Search all listings…" }).fill(typo);
  await expect(page.getByText(new RegExp(word, "i")).first()).toBeVisible();
});

test("search map view opens and closes", async ({ page }) => {
  await openSearch(page);
  await page.getByRole("button", { name: "Show results on a map" }).click();
  await expect(page.locator('iframe[title="Listings map"]')).toBeVisible();
  await expect(page.getByText(/ads shown|can be placed/)).toBeVisible();
  const map = page.frameLocator('iframe[title="Listings map"]');
  await expect(map.locator(".leaflet-container")).toBeVisible();
  await page.getByRole("button", { name: "Show results as a list" }).click();
  await expect(page.locator('iframe[title="Listings map"]')).toHaveCount(0);
});

test("listing page shows price, ZiG estimate, map and buyer actions", async ({ page }) => {
  await openSearch(page);
  await page.getByText(/^≈ ZiG /).first().click();
  await expect(page).toHaveURL(/\/listing\//);
  await expect(page.getByText(/≈ ZiG .* at today's rate/)).toBeVisible();
  await expect(page.getByText("Chat with seller")).toBeVisible();
  await expect(page.getByText("Trade safely")).toBeVisible();
  // Location map renders on web (used to say "WebView does not support this platform").
  await expect(page.getByText("React Native WebView does not support this platform.")).toHaveCount(0);
});

test("sign in renders with the SVG flag and no emoji", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByLabel("Zimbabwe flag")).toBeVisible();
  await expect(page.getByText("🇿🇼")).toHaveCount(0);
});

test("chiShona applies instantly and survives a reload", async ({ page }) => {
  await page.goto("/language-settings");
  await page.getByRole("radio", { name: /chiShona/ }).click();
  await page.evaluate(() => sessionStorage.setItem("e2e-lang-kept", "1"));
  await page.goto("/sign-in");
  await expect(page.getByText("Mauya zvakare")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Mauya zvakare")).toBeVisible();
  // Back to English so later tests aren't affected.
  await page.goto("/language-settings");
  await page.getByRole("radio", { name: /English/ }).click();
  await page.evaluate(() => sessionStorage.removeItem("e2e-lang-kept"));
});

test("help bot answers a Shona question and hands off gracefully", async ({ page }) => {
  await page.goto("/report-problem");
  await expect(page.getByText(/I'm PaMarket Help/)).toBeVisible();
  const input = page.getByRole("textbox", { name: "Type your question..." });
  await input.fill("ndakakanganwa pasiwedhi yangu");
  await input.press("Enter");
  await expect(page.getByText(/Forgot your current password\?|Forgot Password/).first()).toBeVisible();
  // A question no topic covers: AI answer if deployed, otherwise a human hand-off.
  await input.fill("can someone deliver my fridge to Gweru");
  await input.press("Enter");
  await expect(page.getByText(/CONTACT OUR TEAM DIRECTLY|deliver/i).last()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("+971 589 772 645")).toHaveCount(0);
});

test("invite screen asks guests to sign in", async ({ page }) => {
  await page.goto("/invite");
  await expect(page.getByText("Sign in to invite friends")).toBeVisible();
});

test("screens that used to start under the status bar now have a header", async ({ page }) => {
  for (const [path, title] of [
    ["/jobs/alerts", "Job Alerts"],
    ["/jobs/company-profile", "Company Profile"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("settings shows the real app version", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText(/^v\d+\.\d+\.\d+$/)).toBeVisible();
  await expect(page.getByText("v1.29.0")).toHaveCount(0);
});
