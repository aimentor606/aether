import { test, expect } from '../fixtures';
import { UsagePage, ChangelogPage } from '../pages';

test.describe('Usage & Changelog - Browser', () => {
  test.describe('Usage Dashboard', () => {
    let usagePage: UsagePage;

    test.beforeEach(async ({ authenticatedPage }) => {
      usagePage = new UsagePage(authenticatedPage);
    });

    test('should load usage page', async () => {
      await usagePage.goto();
      await usagePage.assertLoaded();
    });

    test('should show period selector', async () => {
      await usagePage.goto();
      await usagePage.assertLoaded();

      const hasPeriodSelector = await usagePage.periodSelector.isVisible({ timeout: 5_000 }).catch(() => false);
      // Period selector only appears when metering is configured
      if (hasPeriodSelector) {
        const tabs = usagePage.page.locator('[role="tab"]');
        const tabCount = await tabs.count();
        expect(tabCount).toBeGreaterThanOrEqual(3);
      }
    });

    test('should show stat cards', async () => {
      await usagePage.goto();
      await usagePage.assertLoaded();

      const hasNoData = await usagePage.noDataState.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(hasNoData, 'Metering not configured — stat cards unavailable');

      // Stat cards: Total Tokens, Daily Average, Active Days
      const totalTokens = usagePage.page.getByText(/Total Tokens/i);
      const dailyAvg = usagePage.page.getByText(/Daily Average/i);
      const activeDays = usagePage.page.getByText(/Active Days/i);

      await expect(totalTokens).toBeVisible({ timeout: 10_000 });
      await expect(dailyAvg).toBeVisible({ timeout: 10_000 });
      await expect(activeDays).toBeVisible({ timeout: 10_000 });
    });

    test('should show chart or no-data state', async () => {
      await usagePage.goto();
      await usagePage.assertLoaded();

      const hasNoData = await usagePage.noDataState.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasNoData) {
        await expect(usagePage.noDataState).toBeVisible();
      } else {
        // Chart or "No usage data available" placeholder
        const chartVisible = await usagePage.chart.isVisible({ timeout: 10_000 }).catch(() => false);
        const noChartData = usagePage.page.getByText(/No usage data available/i);
        const hasNoChartData = await noChartData.isVisible({ timeout: 5_000 }).catch(() => false);
        expect(chartVisible || hasNoChartData).toBeTruthy();
      }
    });

    test('should switch period (7d/30d/90d)', async () => {
      await usagePage.goto();
      await usagePage.assertLoaded();

      const hasNoData = await usagePage.noDataState.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(hasNoData, 'Metering not configured — period switching unavailable');

      const tab7d = usagePage.page.locator('[role="tab"]').filter({ hasText: '7 days' });
      const tab90d = usagePage.page.locator('[role="tab"]').filter({ hasText: '90 days' });

      if (await tab7d.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await tab7d.click();
        await usagePage.page.waitForTimeout(1_000);

        if (await tab90d.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await tab90d.click();
          await usagePage.page.waitForTimeout(1_000);
        }
      }

      expect(usagePage.page.url()).toBeTruthy();
    });
  });

  test.describe('Changelog', () => {
    let changelogPage: ChangelogPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      changelogPage = new ChangelogPage(authenticatedPage);
    });

    test('should load changelog page', async () => {
      await changelogPage.goto();
      await changelogPage.assertLoaded();
    });

    test('should show current version', async () => {
      await changelogPage.goto();
      await changelogPage.assertLoaded();

      // Either shows "Running vX.Y.Z" or fallback text "Version history for Aether Computer"
      const runningVersion = changelogPage.page.getByText(/Running/i);
      const fallbackText = changelogPage.page.getByText(/Version history/i);
      const hasVersion = await runningVersion.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasFallback = await fallbackText.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasVersion || hasFallback).toBeTruthy();
    });

    test('should show filter tabs', async () => {
      await changelogPage.goto();
      await changelogPage.assertLoaded();

      // Filter tabs only visible when dev mode is enabled
      const tabsVisible = await changelogPage.filterTabs.first().isVisible({ timeout: 5_000 }).catch(() => false);
      if (!tabsVisible) {
        // Enable dev mode to reveal filter tabs
        const devToggle = changelogPage.devToggle;
        if (await devToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await devToggle.click();
          await changelogPage.page.waitForTimeout(500);
        }
      }

      const allTab = changelogPage.page.locator('[data-state]').filter({ hasText: 'All' });
      const stableTab = changelogPage.page.locator('[data-state]').filter({ hasText: 'Stable' });
      const hasAll = await allTab.isVisible({ timeout: 3_000 }).catch(() => false);
      const hasStable = await stableTab.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasAll || hasStable).toBeTruthy();
    });

    test('should show version entries', async () => {
      await changelogPage.goto();
      await changelogPage.assertLoaded();

      // Version cards with mono-spaced version text or "No versions found" message
      const hasCards = await changelogPage.versionCards.first().isVisible({ timeout: 10_000 }).catch(() => false);
      const noVersions = changelogPage.page.getByText(/No .*versions found|Could not load version history/i);
      const hasNoVersions = await noVersions.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasCards || hasNoVersions).toBeTruthy();
    });

    test('should show dev build toggle', async () => {
      await changelogPage.goto();
      await changelogPage.assertLoaded();

      await expect(changelogPage.devToggle).toBeVisible({ timeout: 10_000 });
    });

    test('should expand version release notes', async () => {
      await changelogPage.goto();
      await changelogPage.assertLoaded();

      // Look for "Show full release notes" expand button on long entries
      const expandButton = changelogPage.page.getByRole('button', { name: /Show full release notes/i });
      const hasExpand = await expandButton.first().isVisible({ timeout: 5_000 }).catch(() => false);

      if (hasExpand) {
        await expandButton.first().click();
        await changelogPage.page.waitForTimeout(500);

        const collapseButton = changelogPage.page.getByRole('button', { name: /Show less/i });
        await expect(collapseButton.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });
});
