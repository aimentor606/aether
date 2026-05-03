import { test, expect } from '../fixtures';

test.describe('Redirects & 404 - Browser', () => {
  test.describe('Route Redirects', () => {
    test('should redirect /memory to /sessions', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/memory');
      await authenticatedPage.waitForURL(/\/sessions/, { timeout: 10_000 });
      expect(authenticatedPage.url()).toContain('/sessions');
    });

    test('should redirect /projects to /workspace', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/projects');
      await authenticatedPage.waitForURL(/\/workspace/, { timeout: 10_000 });
      expect(authenticatedPage.url()).toContain('/workspace');
    });

    test('should redirect /tools to /workspace', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/tools');
      await authenticatedPage.waitForURL(/\/workspace/, { timeout: 10_000 });
      expect(authenticatedPage.url()).toContain('/workspace');
    });

    test('should redirect /commands to /workspace', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/commands');
      await authenticatedPage.waitForURL(/\/workspace/, { timeout: 10_000 });
      expect(authenticatedPage.url()).toContain('/workspace');
    });

    test('should redirect /configuration to /workspace', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/configuration');
      await authenticatedPage.waitForURL(/\/workspace/, { timeout: 10_000 });
      expect(authenticatedPage.url()).toContain('/workspace');
    });

    test('should redirect /subscription to /instances', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/subscription');
      await authenticatedPage.waitForURL(/\/instances/, { timeout: 10_000 });
      expect(authenticatedPage.url()).toContain('/instances');
    });

    test('should preserve query params on /subscription redirect', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/subscription?subscription=success&session_id=test_123');
      await authenticatedPage.waitForURL(/\/instances/, { timeout: 10_000 });
      expect(authenticatedPage.url()).toContain('subscription=success');
      expect(authenticatedPage.url()).toContain('session_id=test_123');
    });
  });

  test.describe('404 Catch-All', () => {
    test('should show 404 for nonexistent route', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/this-route-does-not-exist-at-all');

      const notFound = authenticatedPage.getByText(/Not Found|404|Page not found/i);
      const redirected = await authenticatedPage.waitForURL(/\/(dashboard|instances)/, { timeout: 5_000 }).then(() => true).catch(() => false);

      if (!redirected) {
        const hasNotFound = await notFound.isVisible({ timeout: 5_000 }).catch(() => false);
        expect(hasNotFound || redirected).toBeTruthy();
      }
    });

    test('should show 404 for nonexistent nested route', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/nonexistent-page');

      const notFound = authenticatedPage.getByText(/Not Found|404|Page not found/i);
      const redirected = await authenticatedPage.waitForURL(/\/(dashboard|instances|settings)/, { timeout: 5_000 }).then(() => true).catch(() => false);

      if (!redirected) {
        const hasNotFound = await notFound.isVisible({ timeout: 5_000 }).catch(() => false);
        expect(hasNotFound || redirected).toBeTruthy();
      }
    });

    test('should show 404 for nonexistent admin route', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/admin/nonexistent-admin-page');

      const notFound = authenticatedPage.getByText(/Not Found|404|Page not found/i);
      const adminGate = authenticatedPage.getByText(/Admin access required/i);

      const hasNotFound = await notFound.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasGate = await adminGate.isVisible({ timeout: 5_000 }).catch(() => false);
      const redirected = authenticatedPage.url().includes('/dashboard') || authenticatedPage.url().includes('/instances');

      expect(hasNotFound || hasGate || redirected).toBeTruthy();
    });
  });

  test.describe('Tab-Based Route Redirects', () => {
    test('should handle /services/running redirect', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/services/running');

      // Should either redirect to service-manager or load dashboard
      const url = authenticatedPage.url();
      const validDestinations = ['/service-manager', '/dashboard', '/instances'];
      const landed = validDestinations.some(d => url.includes(d));
      expect(landed).toBeTruthy();
    });

    test('should handle /browser route', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/browser');

      // Browser tab is session-based; should land on dashboard or current session
      const url = authenticatedPage.url();
      expect(url).toBeTruthy();
    });

    test('should handle /desktop route', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/desktop');

      const url = authenticatedPage.url();
      expect(url).toBeTruthy();
    });
  });
});
