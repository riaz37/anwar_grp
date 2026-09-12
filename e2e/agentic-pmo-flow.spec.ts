import { expect, test } from "@playwright/test";

/**
 * End-to-end flow for the Agentic PMO dashboard feature set
 * (AGENTIC_DASHBOARD_PLAN.md Group I). Runs against a local Docker
 * Postgres seeded by `prisma/seed.ts` — never the cloud DB.
 *
 * Logs in as the AI Team Lead (the only role with RECORD_RISK,
 * MANAGE_STAKEHOLDERS, and VIEW_MANAGEMENT_DASHBOARD all at once), walks
 * the Management Dashboard's attention queue into the seeded
 * "Claims Intake Automation" project (it already carries a pre-seeded
 * AgentFlag and open Risk), then drives RACI, Risks, and Timeline.
 *
 * The seed intentionally gives Claims Intake Automation two
 * ProjectStakeholder rows (one CONSULTED, one INFORMED) specifically so it
 * does *not* start with an ownership gap — this test removes both via the
 * RACI tab's own UI to produce the NO_CONSULTED_OR_INFORMED gap condition,
 * rather than relying on a project the seed happens to leave gapped.
 */
test("agentic PMO flow: attention queue -> RACI gap -> risk -> timeline", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("teamlead@anwargroup.test");
  await page.getByLabel("Password", { exact: true }).fill("ProjectFlow!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");

  await page.goto("/dashboard");
  const attentionRow = page.getByRole("link", { name: /Agent · Stuck milestone/ });
  await expect(attentionRow).toBeVisible();
  await attentionRow.click();

  await page.waitForURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Claims Intake Automation" })).toBeVisible();

  // --- RACI tab: remove both seeded stakeholders to create an ownership gap ---
  await page.getByRole("tab", { name: /RACI/ }).click();

  for (let i = 0; i < 2; i++) {
    const removeButton = page.getByRole("button", { name: "Remove" }).first();
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    await expect(page.getByText("Stakeholder removed")).toBeVisible();
    await expect(page.getByText("Updating project…")).toBeHidden({ timeout: 15_000 });
  }

  await expect(page.getByText(/ownership gap at this stage/i).first()).toBeVisible();

  // --- Risks tab: record a HIGH/HIGH risk ---
  await page.getByRole("tab", { name: /^Risks/ }).click();
  await page.getByRole("button", { name: "Record risk" }).click();

  const riskTitle = `E2E surfaced vendor outage risk ${Date.now()}`;
  await page.getByLabel("Title").fill(riskTitle);
  await page
    .getByLabel("Description")
    .fill("Playwright E2E: simulated high-likelihood, high-impact risk to verify the risk register and timeline.");

  // These are Radix Selects (a trigger button, not a native <select>): open
  // each combobox and click the option rather than using selectOption().
  await page.getByLabel("Likelihood").click();
  await page.getByRole("option", { name: "High" }).click();
  await page.getByLabel("Impact").click();
  await page.getByRole("option", { name: "High" }).click();
  await page.getByLabel("Owner").click();
  await page.getByRole("option").first().click();

  await page.getByRole("button", { name: "Record risk" }).click();

  await expect(page.getByText("Risk recorded")).toBeVisible();
  await expect(page.getByText("Updating project…")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(riskTitle)).toBeVisible();
  await expect(page.getByText("High severity").first()).toBeVisible();

  // --- Timeline tab: confirm the new risk shows up as a "risk raised" entry ---
  await page.getByRole("tab", { name: /^Timeline/ }).click();
  await expect(page.getByText("Risk raised").first()).toBeVisible();
  await expect(page.getByText(riskTitle)).toBeVisible();
});
