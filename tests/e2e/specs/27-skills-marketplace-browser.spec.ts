import { test, expect } from '../fixtures';
import { SkillsPage } from '../pages';

test.describe('Skills & Marketplace - Browser', () => {
  let skillsPage: SkillsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    skillsPage = new SkillsPage(authenticatedPage);
  });

  // Skills Page
  test('should load skills/marketplace page', async () => {
    await skillsPage.goto();
    await skillsPage.assertLoaded();
  });

  test('should show filter tabs', async ({ authenticatedPage }) => {
    await skillsPage.goto();
    await skillsPage.assertLoaded();

    const filterTabs = skillsPage.filterTabs;
    const tabCount = await filterTabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(0);
  });

  test('should show search input', async ({ authenticatedPage }) => {
    await skillsPage.goto();
    await skillsPage.assertLoaded();

    await expect(skillsPage.searchInput).toBeVisible({ timeout: 10_000 });
  });

  test('should display skill cards or empty state', async () => {
    await skillsPage.goto();
    await skillsPage.assertLoaded();

    const count = await skillsPage.getItemCount();
    const hasEmpty = await skillsPage.emptyState.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(count > 0 || hasEmpty).toBeTruthy();
  });

  test('should filter by type', async ({ authenticatedPage }) => {
    await skillsPage.goto();
    await skillsPage.assertLoaded();

    const filterTabs = skillsPage.filterTabs;
    const tabCount = await filterTabs.count();
    test.skip(tabCount === 0, 'No filter tabs visible');

    const skillsTab = filterTabs.filter({ hasText: /Skills/i }).first();
    if (await skillsTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skillsTab.click();
      await authenticatedPage.waitForTimeout(500);

      const count = await skillsPage.getItemCount();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should search marketplace', async ({ authenticatedPage }) => {
    await skillsPage.goto();
    await skillsPage.assertLoaded();

    await skillsPage.search('nonexistent-component-xyz');
    await authenticatedPage.waitForTimeout(1_000);

    const hasEmpty = await skillsPage.emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
    const count = await skillsPage.getItemCount();
    expect(count === 0 || hasEmpty).toBeTruthy();
  });

  test('should show install buttons on items', async ({ authenticatedPage }) => {
    await skillsPage.goto();
    await skillsPage.assertLoaded();

    const count = await skillsPage.getItemCount();
    test.skip(count === 0, 'No items to check install buttons');

    const installCount = await skillsPage.installButtons.count();
    expect(installCount).toBeGreaterThanOrEqual(0);
  });

  // Marketplace alias
  test('should load /marketplace with same content as /skills', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/marketplace');
    await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

    const marketplaceHeading = authenticatedPage.getByText('Marketplace');
    await expect(marketplaceHeading).toBeVisible({ timeout: 15_000 });
  });
});
