import { test, expect } from '../fixtures';
import {
  AdminAccessRequestsPage,
  AdminFeatureFlagsPage,
  AdminLiteLLMPage,
  AdminNotificationsPage,
  AdminUtilsPage,
  AdminFeedbackPage,
} from '../pages';

test.describe('Admin Panel - Basic Pages', () => {
  async function skipIfNotAdmin(page: import('@playwright/test').Page) {
    const adminGate = page.getByText(/Admin access required/i);
    const hasGate = await adminGate
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (hasGate) test.skip(true, 'User does not have admin role');
  }

  test.describe('Access Requests', () => {
    let accessPage: AdminAccessRequestsPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      accessPage = new AdminAccessRequestsPage(authenticatedPage);
    });

    test('should load access requests page', async () => {
      await accessPage.goto();
      await skipIfNotAdmin(accessPage.page);
      await accessPage.assertLoaded();
    });

    test('should show summary cards', async () => {
      await accessPage.goto();
      await skipIfNotAdmin(accessPage.page);
      await accessPage.assertLoaded();

      const cardCount = await accessPage.summaryCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('should show tab navigation', async () => {
      await accessPage.goto();
      await skipIfNotAdmin(accessPage.page);
      await accessPage.assertLoaded();

      const tabCount = await accessPage.tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(1);
    });

    test('should show requests table or empty state', async () => {
      await accessPage.goto();
      await skipIfNotAdmin(accessPage.page);
      await accessPage.assertLoaded();

      const hasTable = await accessPage.table
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      const hasEmpty = await accessPage.page
        .getByText(/No .*requests/i)
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('should switch between tabs', async () => {
      await accessPage.goto();
      await skipIfNotAdmin(accessPage.page);
      await accessPage.assertLoaded();

      const tabCount = await accessPage.tabs.count();
      test.skip(tabCount < 2, 'Not enough tabs to switch');

      await accessPage.switchTab('Approved');
      await accessPage.page.waitForTimeout(500);
    });
  });

  test.describe('Feature Flags', () => {
    let flagsPage: AdminFeatureFlagsPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      flagsPage = new AdminFeatureFlagsPage(authenticatedPage);
    });

    test('should load feature flags page', async () => {
      await flagsPage.goto();
      await skipIfNotAdmin(flagsPage.page);
      await flagsPage.assertLoaded();
    });

    test('should show add flag button', async () => {
      await flagsPage.goto();
      await skipIfNotAdmin(flagsPage.page);
      await flagsPage.assertLoaded();

      await expect(flagsPage.addFlagButton).toBeVisible({ timeout: 5_000 });
    });

    test('should show refresh button', async () => {
      await flagsPage.goto();
      await skipIfNotAdmin(flagsPage.page);
      await flagsPage.assertLoaded();

      await expect(flagsPage.refreshButton).toBeVisible({ timeout: 5_000 });
    });

    test('should show flags table or empty state', async () => {
      await flagsPage.goto();
      await skipIfNotAdmin(flagsPage.page);
      await flagsPage.assertLoaded();

      const hasTable = await flagsPage.table
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      const hasEmpty = await flagsPage.page
        .getByText(/No feature flags/i)
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();
    });
  });

  test.describe('LiteLLM', () => {
    let litellmPage: AdminLiteLLMPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      litellmPage = new AdminLiteLLMPage(authenticatedPage);
    });

    test('should load litellm management page', async () => {
      await litellmPage.goto();
      await skipIfNotAdmin(litellmPage.page);
      await litellmPage.assertLoaded();
    });

    test('should show status cards', async () => {
      await litellmPage.goto();
      await skipIfNotAdmin(litellmPage.page);
      await litellmPage.assertLoaded();

      const cardCount = await litellmPage.statusCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('should show model catalog', async () => {
      await litellmPage.goto();
      await skipIfNotAdmin(litellmPage.page);
      await litellmPage.assertLoaded();

      await expect(litellmPage.modelCatalog).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Notifications', () => {
    let notifPage: AdminNotificationsPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      notifPage = new AdminNotificationsPage(authenticatedPage);
    });

    test('should load notifications page', async () => {
      await notifPage.goto();
      await skipIfNotAdmin(notifPage.page);
      await notifPage.assertLoaded();
    });

    test('should show send button', async () => {
      await notifPage.goto();
      await skipIfNotAdmin(notifPage.page);
      await notifPage.assertLoaded();

      await expect(notifPage.sendButton).toBeVisible({ timeout: 5_000 });
    });

    test('should show workflow selector', async () => {
      await notifPage.goto();
      await skipIfNotAdmin(notifPage.page);
      await notifPage.assertLoaded();

      await expect(notifPage.workflowSelect).toBeVisible({ timeout: 5_000 });
    });

    test('should show payload textarea', async () => {
      await notifPage.goto();
      await skipIfNotAdmin(notifPage.page);
      await notifPage.assertLoaded();

      await expect(notifPage.payloadTextarea).toBeVisible({ timeout: 5_000 });
    });

    test('should toggle broadcast mode', async () => {
      await notifPage.goto();
      await skipIfNotAdmin(notifPage.page);
      await notifPage.assertLoaded();

      await expect(notifPage.broadcastSwitch).toBeVisible({ timeout: 5_000 });
      await notifPage.broadcastSwitch.click();
      await notifPage.page.waitForTimeout(500);
    });
  });

  test.describe('Utils', () => {
    let utilsPage: AdminUtilsPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      utilsPage = new AdminUtilsPage(authenticatedPage);
    });

    test('should load admin utils page', async () => {
      await utilsPage.goto();
      await skipIfNotAdmin(utilsPage.page);
      await utilsPage.assertLoaded();
    });

    test('should show maintenance card', async () => {
      await utilsPage.goto();
      await skipIfNotAdmin(utilsPage.page);
      await utilsPage.assertLoaded();

      await expect(utilsPage.maintenanceCard).toBeVisible({ timeout: 5_000 });
    });

    test('should show technical issue card', async () => {
      await utilsPage.goto();
      await skipIfNotAdmin(utilsPage.page);
      await utilsPage.assertLoaded();

      await expect(utilsPage.technicalIssueCard).toBeVisible({ timeout: 5_000 });
    });

    test('should open maintenance dialog on click', async () => {
      await utilsPage.goto();
      await skipIfNotAdmin(utilsPage.page);
      await utilsPage.assertLoaded();

      await utilsPage.maintenanceCard.click();
      await expect(utilsPage.maintenanceDialog).toBeVisible({ timeout: 5_000 });
    });

    test('should open technical issue dialog on click', async () => {
      await utilsPage.goto();
      await skipIfNotAdmin(utilsPage.page);
      await utilsPage.assertLoaded();

      await utilsPage.technicalIssueCard.click();
      await expect(utilsPage.technicalIssueDialog).toBeVisible({
        timeout: 5_000,
      });
    });
  });

  test.describe('Feedback', () => {
    let feedbackPage: AdminFeedbackPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      feedbackPage = new AdminFeedbackPage(authenticatedPage);
    });

    test('should load feedback analytics page', async () => {
      await feedbackPage.goto();
      await skipIfNotAdmin(feedbackPage.page);
      await feedbackPage.assertLoaded();
    });

    test('should show tab navigation', async () => {
      await feedbackPage.goto();
      await skipIfNotAdmin(feedbackPage.page);
      await feedbackPage.assertLoaded();

      const tabCount = await feedbackPage.tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(1);
    });

    test('should show stats cards', async () => {
      await feedbackPage.goto();
      await skipIfNotAdmin(feedbackPage.page);
      await feedbackPage.assertLoaded();

      const cardCount = await feedbackPage.statsCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('should switch to All Feedback tab', async () => {
      await feedbackPage.goto();
      await skipIfNotAdmin(feedbackPage.page);
      await feedbackPage.assertLoaded();

      const tabCount = await feedbackPage.tabs.count();
      test.skip(tabCount < 2, 'Not enough tabs to switch');

      await feedbackPage.switchTab('All Feedback');
      await feedbackPage.page.waitForTimeout(500);
    });
  });
});
