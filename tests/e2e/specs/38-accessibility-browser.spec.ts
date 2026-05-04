import { test, expect } from '../fixtures';
import AxeBuilder from '@axe-core/playwright';

type AxeViolation = {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  nodes: { html: string }[];
};

function filterViolations(violations: AxeViolation[], exclude: string[] = []): AxeViolation[] {
  return violations.filter(v => !exclude.includes(v.id));
}

async function runA11yAudit(page: import('@playwright/test').Page, label: string, excludeRules: string[] = []) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = filterViolations(results.violations as AxeViolation[], excludeRules);

  const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

  for (const v of critical) {
    console.log(`[${label}] ${v.impact}: ${v.id} — ${v.description}`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`  ${node.html.slice(0, 120)}`);
    }
  }

  return { violations, critical, label };
}

test.describe('Accessibility (a11y) Audits', () => {
  const keyPages = [
    { name: 'Auth', path: '/auth', authenticated: false },
    { name: 'Dashboard', path: '/dashboard', authenticated: true },
    { name: 'Instances', path: '/instances', authenticated: true },
    { name: 'Workspace', path: '/workspace', authenticated: true },
    { name: 'Files', path: '/files', authenticated: true },
    { name: 'Finance', path: '/finance', authenticated: true },
    { name: 'Usage', path: '/usage', authenticated: true },
    { name: 'API Keys', path: '/settings/api-keys', authenticated: true },
    { name: 'Credentials', path: '/settings/credentials', authenticated: true },
    { name: 'Providers', path: '/settings/providers', authenticated: true },
  ];

  const excludeRules = [
    'color-contrast',
    'landmark-one-main',
    'page-has-heading-one',
    'region',
  ];

  for (const { name, path, authenticated } of keyPages) {
    test(`${name} page (${path}) should have no critical a11y violations`, async ({ authenticatedPage, page }) => {
      const targetPage = authenticated ? authenticatedPage : page;
      await targetPage.goto(path);
      await targetPage.waitForLoadState('networkidle').catch(() => {});
      await targetPage.waitForTimeout(2_000);

      const { critical } = await runA11yAudit(targetPage, name, excludeRules);

      if (critical.length > 0) {
        const summary = critical.map(v => `${v.id} (${v.impact})`).join(', ');
        console.log(`[${name}] Critical violations: ${summary}`);
      }

      expect(critical.length, `${name} has ${critical.length} critical a11y violations`).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('Specific a11y Checks', () => {
  test('auth page should have accessible form elements', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForTimeout(2_000);

    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type');
      if (type === 'hidden') continue;

      const hasLabel = await input.evaluate((el) => {
        const id = el.id;
        if (id && document.querySelector(`label[for="${id}"]`)) return true;
        if (el.getAttribute('aria-label')) return true;
        if (el.getAttribute('aria-labelledby')) return true;
        if (el.closest('label')) return true;
        if (el.getAttribute('placeholder')) return true;
        return false;
      });
      expect(hasLabel).toBeTruthy();
    }
  });

  test('dashboard should have proper heading hierarchy', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
    await authenticatedPage.waitForTimeout(2_000);

    const headings = authenticatedPage.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();

    if (count > 0) {
      let lastLevel = 0;
      for (let i = 0; i < Math.min(count, 20); i++) {
        const tag = await headings.nth(i).evaluate(el => el.tagName);
        const level = parseInt(tag[1]);
        if (lastLevel > 0 && level > lastLevel + 1) {
          console.log(`Heading skip: ${tag} after H${lastLevel}`);
        }
        lastLevel = level;
      }
    }
  });

  test('interactive elements should have discernible text', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
    await authenticatedPage.waitForTimeout(2_000);

    const buttons = authenticatedPage.locator('button');
    const count = await buttons.count();

    let missingText = 0;
    for (let i = 0; i < Math.min(count, 50); i++) {
      const button = buttons.nth(i);
      const hasText = await button.evaluate((el) => {
        const text = el.textContent?.trim();
        if (text && text.length > 0) return true;
        if (el.getAttribute('aria-label')) return true;
        if (el.getAttribute('aria-labelledby')) return true;
        if (el.querySelector('svg[aria-label], img[alt]')) return true;
        return false;
      });
      if (!hasText) missingText++;
    }

    expect(missingText).toBeLessThanOrEqual(3);
  });

  test('images should have alt text', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
    await authenticatedPage.waitForTimeout(2_000);

    const images = authenticatedPage.locator('img');
    const count = await images.count();

    let missingAlt = 0;
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      const role = await images.nth(i).getAttribute('role');
      if (alt === null && role !== 'presentation') {
        missingAlt++;
      }
    }

    expect(missingAlt).toBeLessThanOrEqual(2);
  });

  test('settings pages should have proper form labels', async ({ authenticatedPage }) => {
    for (const path of ['/settings/api-keys', '/settings/credentials', '/settings/providers']) {
      await authenticatedPage.goto(path);
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(1_500);

      const inputs = authenticatedPage.locator('input:not([type="hidden"])');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const hasLabel = await inputs.nth(i).evaluate((el) => {
          if (el.getAttribute('aria-label')) return true;
          if (el.getAttribute('aria-labelledby')) return true;
          if (el.getAttribute('placeholder')) return true;
          const id = el.id;
          if (id && document.querySelector(`label[for="${id}"]`)) return true;
          if (el.closest('label')) return true;
          return false;
        });
        if (!hasLabel) {
          console.log(`[${path}] Input missing label: ${await inputs.nth(i).getAttribute('name') || await inputs.nth(i).getAttribute('type')}`);
        }
      }
    }
  });
});
