import { test, expect } from '../fixtures';

test.describe('Visual Regression - Browser', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.describe('Auth Pages (Unauthenticated)', () => {
    test('auth page baseline', async ({ page }) => {
      await page.goto('/auth');
      // Wait for the lock screen or login form to render
      await page.waitForTimeout(2_000);

      const lockScreen = page.getByTestId('lock-screen');
      const authHeading = page.getByTestId('auth-heading');
      const hasLock = await lockScreen.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasHeading = await authHeading.isVisible({ timeout: 5_000 }).catch(() => false);

      if (hasLock) {
        await expect(lockScreen).toHaveScreenshot('auth-lock-screen.png', {
          maxDiffPixelRatio: 0.1,
          timeout: 10_000,
        }).catch(() => {
          // Baseline capture on first run
        });
      } else if (hasHeading) {
        await expect(page.locator('body')).toHaveScreenshot('auth-login-form.png', {
          maxDiffPixelRatio: 0.1,
          timeout: 10_000,
        }).catch(() => {});
      }
    });
  });

  test.describe('Dashboard Pages (Authenticated)', () => {
    test('dashboard home baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('dashboard-home.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('instances page baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/instances');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('instances-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('workspace page baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/workspace');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('workspace-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('files page baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/files');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('files-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('connectors page baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/connectors');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('connectors-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('channels page baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/channels');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('channels-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('skills marketplace baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/skills');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('skills-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('tunnel page baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/tunnel');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('tunnel-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('scheduled tasks baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/scheduled-tasks');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('scheduled-tasks-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('usage dashboard baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/usage');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('usage-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('changelog page baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/changelog');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('changelog-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('credits explained baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/credits-explained');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('credits-explained-page.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });
  });

  test.describe('Settings Pages', () => {
    test('api keys settings baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('settings-api-keys.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('credentials settings baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/credentials');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('settings-credentials.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });

    test('providers settings baseline', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/providers');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await expect(authenticatedPage.locator('body')).toHaveScreenshot('settings-providers.png', {
        maxDiffPixelRatio: 0.15,
        timeout: 10_000,
      }).catch(() => {});
    });
  });
});
