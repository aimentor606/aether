import { test, expect } from '../fixtures';
import { TunnelOverviewPage, TunnelDetailPage } from '../pages';

test.describe('Tunnel Management - Browser', () => {
  // Tunnel Overview
  test('should load tunnel overview page', async ({ authenticatedPage }) => {
    const tunnelPage = new TunnelOverviewPage(authenticatedPage);
    await tunnelPage.goto();
    await tunnelPage.assertLoaded();
  });

  test('should show create tunnel button', async ({ authenticatedPage }) => {
    const tunnelPage = new TunnelOverviewPage(authenticatedPage);
    await tunnelPage.goto();
    await tunnelPage.assertLoaded();

    await expect(tunnelPage.createButton).toBeVisible({ timeout: 10_000 });
  });

  test('should show connection cards or empty state', async ({ authenticatedPage }) => {
    const tunnelPage = new TunnelOverviewPage(authenticatedPage);
    await tunnelPage.goto();
    await tunnelPage.assertLoaded();

    const hasCards = (await tunnelPage.connectionCards.count()) > 0;
    const hasEmpty = await tunnelPage.emptyState.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test('should show online/offline status indicators', async ({ authenticatedPage }) => {
    const tunnelPage = new TunnelOverviewPage(authenticatedPage);
    await tunnelPage.goto();
    await tunnelPage.assertLoaded();

    const hasCards = (await tunnelPage.connectionCards.count()) > 0;
    test.skip(!hasCards, 'No tunnel connections to check status');

    const onlineCount = await tunnelPage.onlineIndicators.count();
    const offlineCount = await tunnelPage.offlineIndicators.count();
    expect(onlineCount + offlineCount).toBeGreaterThan(0);
  });

  // Tunnel Detail
  test('should show not found for invalid tunnel ID', async ({ authenticatedPage }) => {
    const detailPage = new TunnelDetailPage(authenticatedPage);
    await detailPage.goto('nonexistent-tunnel-id-99999');

    const notFound = authenticatedPage.getByText(/not found/i);
    await expect(notFound).toBeVisible({ timeout: 15_000 });
  });

  test('should show back navigation from detail page', async ({ authenticatedPage }) => {
    const detailPage = new TunnelDetailPage(authenticatedPage);
    await detailPage.goto('nonexistent-tunnel-id-99999');

    const backButton = detailPage.backButton.or(
      authenticatedPage.getByRole('button', { name: /Back to tunnels/i }),
    );
    await expect(backButton).toBeVisible({ timeout: 15_000 });
  });
});
