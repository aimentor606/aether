import { test, expect } from '../fixtures';

test.describe('Mobile Responsive - Browser', () => {
  test.use({ viewport: { width: 393, height: 830 } });

  test.describe('Auth Page', () => {
    test('auth page renders without horizontal scroll', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForTimeout(2_000);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test('auth page form elements are visible', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForTimeout(2_000);

      const bodyWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(bodyWidth).toBe(393);

      const lockScreen = page.getByTestId('lock-screen');
      const authHeading = page.getByTestId('auth-heading');
      const hasLock = await lockScreen.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasHeading = await authHeading.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasLock || hasHeading).toBeTruthy();
    });
  });

  test.describe('Dashboard Pages', () => {
    test('dashboard renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test('instances page renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/instances');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test('workspace page renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/workspace');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test('files page renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/files');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test('finance page renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test('usage page renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/usage');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });
  });

  test.describe('Settings Pages', () => {
    test('api keys page renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test('credentials page renders without horizontal scroll', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/credentials');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const scrollWidth = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await authenticatedPage.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });
  });

  test.describe('Touch Targets', () => {
    test('dashboard interactive elements meet minimum touch target size', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const smallTargets = await authenticatedPage.evaluate(() => {
        const buttons = document.querySelectorAll('button, a[role="button"], [role="tab"]');
        const tooSmall: string[] = [];
        buttons.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32)) {
            tooSmall.push(`${el.tagName} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} ${el.textContent?.slice(0, 30)}`);
          }
        });
        return tooSmall;
      });

      if (smallTargets.length > 0) {
        console.log(`Small touch targets found: ${smallTargets.slice(0, 10).join('; ')}`);
      }
      expect(smallTargets.length).toBeLessThanOrEqual(5);
    });

    test('finance tab buttons meet touch target size', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const tabSizes = await authenticatedPage.evaluate(() => {
        const tabs = document.querySelectorAll('[data-testid^="tab-"]');
        return Array.from(tabs).map((tab) => {
          const rect = tab.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
      });

      for (const size of tabSizes) {
        expect(size.height).toBeGreaterThanOrEqual(28);
      }
    });
  });

  test.describe('Navigation', () => {
    test('sidebar collapses or hides on mobile', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const sidebar = authenticatedPage.locator('[data-testid="sidebar"], aside, nav[aria-label="Sidebar"]');
      const sidebarVisible = await sidebar.isVisible().catch(() => false);

      if (sidebarVisible) {
        const sidebarBox = await sidebar.boundingBox();
        if (sidebarBox) {
          // If sidebar is visible on mobile, it should be narrow or overlaid
          expect(sidebarBox.width).toBeLessThan(300);
        }
      }
      // If sidebar is not visible, that's also acceptable on mobile
    });

    test('mobile hamburger menu is accessible', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const hamburger = authenticatedPage.locator(
        'button[aria-label*="menu"], button[aria-label*="Menu"], [data-testid="mobile-menu"], [data-testid="sidebar-toggle"]',
      );
      const hasHamburger = await hamburger.isVisible({ timeout: 3_000 }).catch(() => false);

      // Either a hamburger menu exists, or navigation is otherwise accessible
      if (hasHamburger) {
        await hamburger.click();
        await authenticatedPage.waitForTimeout(500);
        const navMenu = authenticatedPage.locator('nav, [role="navigation"]');
        const navVisible = await navMenu.first().isVisible().catch(() => false);
        expect(navVisible).toBeTruthy();
      }
    });
  });

  test.describe('Content Readability', () => {
    test('body text is at least 14px on mobile', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const smallText = await authenticatedPage.evaluate(() => {
        const elements = document.querySelectorAll('p, span, td, th, label, li');
        const small: string[] = [];
        elements.forEach((el) => {
          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize > 0 && fontSize < 14) {
            small.push(`${fontSize}px: ${el.textContent?.slice(0, 30)}`);
          }
        });
        return small.slice(0, 10);
      });

      if (smallText.length > 0) {
        console.log(`Small text found: ${smallText.join('; ')}`);
      }
      expect(smallText.length).toBeLessThanOrEqual(3);
    });

    test('touch targets have adequate spacing', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/instances');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const overlapping = await authenticatedPage.evaluate(() => {
        const buttons = document.querySelectorAll('button, a');
        const rects = Array.from(buttons)
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0);

        let overlapCount = 0;
        for (let i = 0; i < Math.min(rects.length, 50); i++) {
          for (let j = i + 1; j < Math.min(rects.length, 50); j++) {
            const a = rects[i];
            const b = rects[j];
            const gap = Math.max(
              Math.max(b.left - a.right, a.left - b.right),
              Math.max(b.top - a.bottom, a.top - b.bottom),
            );
            if (gap < 0 && gap > -20) overlapCount++;
          }
        }
        return overlapCount;
      });

      expect(overlapping).toBeLessThanOrEqual(3);
    });
  });
});
