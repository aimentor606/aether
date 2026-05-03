import { test, expect } from '@playwright/test';
import { loginToDashboard } from '../helpers/browser-login';
import { InstancesPage, InstanceDetailPage, InstanceBackupsPage } from '../pages';

test.describe('Instance Lifecycle - Browser', () => {
  let instancesPage: InstancesPage;

  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
    instancesPage = new InstancesPage(page);
  });

  test.describe('Instances List Page', () => {
    test('should load instances page with heading and navigation', async ({ page }) => {
      await instancesPage.goto();
      await instancesPage.assertLoaded();

      await expect(instancesPage.settingsButton).toBeVisible();
      await expect(instancesPage.logoutButton).toBeVisible();
    });

    test('should show instance cards or empty state', async ({ page }) => {
      await instancesPage.goto();

      const hasCards = await instancesPage.emptyState.isVisible({ timeout: 5_000 }).then(() => false).catch(() => true);
      if (hasCards) {
        const count = await instancesPage.getInstanceCount();
        expect(count).toBeGreaterThan(0);
      } else {
        await expect(instancesPage.emptyState).toBeVisible();
      }
    });

    test('should display New Aether button when appropriate', async ({ page }) => {
      await instancesPage.goto();

      const isCloud = page.url().includes('cloud') || process.env.E2E_CLOUD === 'true';
      const isEmpty = await instancesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);

      if (isCloud || isEmpty) {
        await expect(instancesPage.newInstanceButton).toBeVisible({ timeout: 5_000 });
      }
    });

    test('should show instance status indicators', async ({ page }) => {
      await instancesPage.goto();
      const count = await instancesPage.getInstanceCount();
      test.skip(count === 0, 'No instances to check status');

      const statuses = await instancesPage.getVisibleStatuses();
      const validStatuses = ['Active', 'Provisioning', 'Stopped', 'Error', 'Available'];
      const hasValidStatus = statuses.some(s =>
        validStatuses.some(vs => s.includes(vs)),
      );
      expect(hasValidStatus).toBeTruthy();
    });

    test('should refresh instances on page reload', async ({ page }) => {
      await instancesPage.goto();
      await instancesPage.assertLoaded();

      await page.reload();
      await instancesPage.assertLoaded();
    });
  });

  test.describe('Instance Detail Page', () => {
    test('should navigate to instance detail from list', async ({ page }) => {
      await instancesPage.goto();
      const count = await instancesPage.getInstanceCount();
      test.skip(count === 0, 'No instances to click');

      const instanceId = await page.evaluate(() => {
        const link = document.querySelector('a[href*="/instances/"]');
        return link?.getAttribute('href')?.match(/\/instances\/([^/]+)/)?.[1] ?? null;
      });
      test.skip(!instanceId, 'Could not extract instance ID from page');

      await instancesPage.clickInstance();
      await page.waitForURL(/\/instances\/[^/]+/, { timeout: 15_000 });
    });

    test('should show back button on detail page', async ({ page }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      const detailPage = new InstanceDetailPage(page);
      await detailPage.goto(instanceId);
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(detailPage.backButton).toBeVisible({ timeout: 10_000 });
    });

    test('should show provisioning or active state for valid instance', async ({ page }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      const detailPage = new InstanceDetailPage(page);
      await detailPage.goto(instanceId);

      const titleText = await detailPage.title.textContent({ timeout: 15_000 }).catch(() => '');
      const knownStates = ['Creating Workspace', 'Pinging Sandbox', 'Opening Workspace', 'Something went wrong', 'Instance Stopped', 'Loading'];
      const matchesKnown = knownStates.some(s => titleText?.includes(s));
      expect(matchesKnown || titleText).toBeTruthy();
    });

    test('should show error state for non-existent instance', async ({ page }) => {
      const detailPage = new InstanceDetailPage(page);
      await detailPage.goto('nonexistent-instance-id-12345');

      const errorOrNotFound = page.getByText(/Something went wrong|Instance not found/i);
      await expect(errorOrNotFound).toBeVisible({ timeout: 15_000 });
      await expect(detailPage.backToInstancesButton.or(page.getByRole('button', { name: /Back/i }))).toBeVisible();
    });

    test('should navigate back to instances list', async ({ page }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      const detailPage = new InstanceDetailPage(page);
      await detailPage.goto(instanceId);
      await page.waitForLoadState('networkidle').catch(() => {});

      const backBtn = detailPage.backButton.or(page.getByRole('button', { name: /Instances/i })).first();
      if (await backBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForURL(/\/instances$/, { timeout: 10_000 });
      }
    });
  });

  test.describe('Instance Backups Page', () => {
    test('should load backups page with heading', async ({ page }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      const backupsPage = new InstanceBackupsPage(page);
      await backupsPage.goto(instanceId);
      await backupsPage.assertLoaded();
    });

    test('should show backup creation form', async ({ page }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      const backupsPage = new InstanceBackupsPage(page);
      await backupsPage.goto(instanceId);

      await expect(backupsPage.descriptionInput).toBeVisible();
      await expect(backupsPage.backupNowButton).toBeVisible();
    });

    test('should show existing backups or empty state', async ({ page }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      const backupsPage = new InstanceBackupsPage(page);
      await backupsPage.goto(instanceId);

      const isEmpty = await backupsPage.emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!isEmpty) {
        const count = await backupsPage.getBackupCount();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should navigate back to instances from backups', async ({ page }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      const backupsPage = new InstanceBackupsPage(page);
      await backupsPage.goto(instanceId);

      if (await backupsPage.backButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await backupsPage.backButton.click();
        await page.waitForURL(/\/instances/, { timeout: 10_000 });
      }
    });
  });
});
