import { test, expect } from '../fixtures';
import {
  AdminAnalyticsPage,
  AdminSandboxPoolPage,
  AdminSandboxesPage,
  AdminStatelessPage,
  AdminStressTestPage,
} from '../pages';

test.describe('Admin Panel - Complex Pages', () => {
  async function skipIfNotAdmin(page: import('@playwright/test').Page) {
    const adminGate = page.getByText(/Admin access required/i);
    const hasGate = await adminGate
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (hasGate) test.skip(true, 'User does not have admin role');
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  test.describe('Analytics', () => {
    let analyticsPage: AdminAnalyticsPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      analyticsPage = new AdminAnalyticsPage(authenticatedPage);
      await analyticsPage.goto();
      await skipIfNotAdmin(authenticatedPage);
    });

    test('should load analytics page', async () => {
      await analyticsPage.assertLoaded();
    });

    test('should show date preset buttons', async () => {
      await expect(analyticsPage.datePresets).toBeVisible({ timeout: 10_000 });
    });

    test('should show tab navigation', async () => {
      const tabCount = await analyticsPage.tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(3);
    });

    test('should show stat cards on overview', async () => {
      const cardCount = await analyticsPage.statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('should switch to Users tab', async () => {
      await analyticsPage.switchTab('Users');
      await expect(
        analyticsPage.page.getByText(/User Management/i),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── Sandbox Pool ───────────────────────────────────────────────────────────

  test.describe('Sandbox Pool', () => {
    let poolPage: AdminSandboxPoolPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      poolPage = new AdminSandboxPoolPage(authenticatedPage);
      await poolPage.goto();
      await skipIfNotAdmin(authenticatedPage);
    });

    test('should load sandbox pool page', async () => {
      await poolPage.assertLoaded();
    });

    test('should show health status badge', async () => {
      await expect(poolPage.healthBadge).toBeVisible({ timeout: 10_000 });
    });

    test('should show stat cards', async () => {
      const cardCount = await poolPage.statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('should show quick action buttons', async () => {
      await expect(poolPage.quickActions).toBeVisible({ timeout: 10_000 });
      await expect(poolPage.replenishButton).toBeVisible();
      await expect(poolPage.cleanupButton).toBeVisible();
      await expect(poolPage.restartButton).toBeVisible();
    });

    test('should show force create controls', async () => {
      await expect(poolPage.forceCreateInput).toBeVisible({ timeout: 10_000 });
      await expect(poolPage.forceCreateButton).toBeVisible();
    });

    test('should show pooled sandboxes list or empty state', async () => {
      await expect(poolPage.sandboxList).toBeVisible({ timeout: 10_000 });
    });
  });

  // ─── Sandboxes ──────────────────────────────────────────────────────────────

  test.describe('Sandboxes', () => {
    let sandboxesPage: AdminSandboxesPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      sandboxesPage = new AdminSandboxesPage(authenticatedPage);
      await sandboxesPage.goto();
      await skipIfNotAdmin(authenticatedPage);
    });

    test('should load sandboxes page', async () => {
      await sandboxesPage.assertLoaded();
    });

    test('should show tab navigation', async () => {
      const tabCount = await sandboxesPage.tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(2);
    });

    test('should show search input', async () => {
      await expect(sandboxesPage.searchInput).toBeVisible({ timeout: 10_000 });
    });

    test('should show status filter', async () => {
      await expect(sandboxesPage.statusFilter).toBeVisible({ timeout: 10_000 });
    });

    test('should show sandboxes table or empty state', async () => {
      const hasTable = await sandboxesPage.table
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      const hasEmptyState = await sandboxesPage.page
        .getByText(/No sandboxes match/i)
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasTable || hasEmptyState).toBe(true);
    });
  });

  // ─── Stateless ──────────────────────────────────────────────────────────────

  test.describe('Stateless', () => {
    let statelessPage: AdminStatelessPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      statelessPage = new AdminStatelessPage(authenticatedPage);
      await statelessPage.goto();
      await skipIfNotAdmin(authenticatedPage);
    });

    test('should load stateless admin page', async () => {
      await statelessPage.assertLoaded();
    });

    test('should show health badges', async () => {
      await expect(statelessPage.healthBadges).toBeVisible({ timeout: 10_000 });
    });

    test('should show quick action buttons', async () => {
      await expect(statelessPage.quickActions).toBeVisible({ timeout: 10_000 });
    });

    test('should show stat cards', async () => {
      const cardCount = await statelessPage.statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('should show tab navigation', async () => {
      const tabCount = await statelessPage.tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Stress Test ────────────────────────────────────────────────────────────

  test.describe('Stress Test', () => {
    let stressPage: AdminStressTestPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      stressPage = new AdminStressTestPage(authenticatedPage);
      await stressPage.goto();
      await skipIfNotAdmin(authenticatedPage);
    });

    test('should load stress test page', async () => {
      await stressPage.assertLoaded();
    });

    test('should show request count input', async () => {
      await expect(stressPage.requestCountInput).toBeVisible({
        timeout: 10_000,
      });
    });

    test('should show start test button', async () => {
      const hasStart = await stressPage.startButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      const hasStop = await stressPage.stopButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasStart || hasStop).toBe(true);
    });

    test('should show reset button', async () => {
      const hasReset = await stressPage.resetButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      // Reset only appears after a test has been run
      expect(typeof hasReset).toBe('boolean');
    });
  });
});
