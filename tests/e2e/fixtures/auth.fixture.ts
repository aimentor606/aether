import { test as base, expect } from '@playwright/test';
import { bootstrapOwner, loginViaBrowser } from '../helpers/browser-login';

type AuthFixture = {
  authenticatedPage: import('@playwright/test').Page;
};

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    await bootstrapOwner(page);
    await loginViaBrowser(page);

    // Wait for post-login state (wizard or dashboard)
    await page.waitForTimeout(5_000);

    // If on onboarding/wizard, skip to dashboard
    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding') || currentUrl.includes('/setup')) {
      await page.goto('/onboarding?skip_onboarding=1');
    }

    // Wait for dashboard to be ready
    await page.waitForURL(/\/(dashboard|instances)/, { timeout: 30_000 });

    await use(page);
  },
});

export { expect };
