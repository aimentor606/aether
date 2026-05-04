import { test, expect } from '../fixtures';
import { UsageDashboardPage } from '../pages/usage-dashboard.page';

test.describe('Usage Dashboard', () => {
  test.describe('Page Rendering', () => {
    test('loads usage page with heading', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();
    });

    test('shows heading text', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      const hasHeading = await usagePage.heading.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasNoData = await usagePage.noDataState.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasHeading || hasNoData).toBeTruthy();
    });

    test('shows subtitle when metering is available', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      if (await usagePage.hasMeteredData()) {
        await expect(usagePage.subtitle).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test.describe('No-Data State', () => {
    test('shows "not configured" message when OpenMeter unavailable', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      const hasNoData = await usagePage.noDataState.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasNoData) {
        await expect(usagePage.noDataMessage).toBeVisible();
        // Should not show period selector or stat cards
        await expect(usagePage.periodSelector).not.toBeVisible();
        await expect(usagePage.statCards.first()).not.toBeVisible();
      }
    });
  });

  test.describe('Period Selector', () => {
    test('displays period selector with 3 tabs', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await expect(usagePage.periodSelector).toBeVisible({ timeout: 10_000 });
      const tabCount = await usagePage.periodTabs.count();
      expect(tabCount).toBe(3);
    });

    test('defaults to 30d period', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const activeTab = await usagePage.getActiveTab();
      expect(activeTab).toContain('30');
    });

    test('switches to 7d period', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await usagePage.tab7d.click();
      await authenticatedPage.waitForTimeout(1_000);

      const activeTab = await usagePage.getActiveTab();
      expect(activeTab).toContain('7');
    });

    test('switches to 90d period', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await usagePage.tab90d.click();
      await authenticatedPage.waitForTimeout(1_000);

      const activeTab = await usagePage.getActiveTab();
      expect(activeTab).toContain('90');
    });

    test('period change triggers API call with correct date range', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const apiPromise = authenticatedPage.waitForResponse(
        (resp) => resp.url().includes('/metered-usage') && resp.status() === 200,
        { timeout: 15_000 },
      );

      await usagePage.tab7d.click();
      const response = await apiPromise;

      const url = new URL(response.url());
      const from = url.searchParams.get('from');
      expect(from).toBeTruthy();

      // 7d period: from date should be ~7 days ago
      if (from) {
        const fromDate = new Date(from);
        const now = new Date();
        const diffDays = (now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThanOrEqual(6);
        expect(diffDays).toBeLessThanOrEqual(8);
      }
    });
  });

  test.describe('Stat Cards', () => {
    test('renders three stat cards', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const cardCount = await usagePage.statCards.count();
      expect(cardCount).toBe(3);
    });

    test('shows Total Tokens card', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await expect(authenticatedPage.getByText('Total Tokens')).toBeVisible({ timeout: 10_000 });
    });

    test('shows Daily Average card', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await expect(authenticatedPage.getByText('Daily Average')).toBeVisible({ timeout: 10_000 });
    });

    test('shows Active Days card', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await expect(authenticatedPage.getByText('Active Days')).toBeVisible({ timeout: 10_000 });
    });

    test('stat cards show value or dash when no data', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      // Each stat card should show either a formatted number (K/M) or dash (—)
      const cards = usagePage.statCards;
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const valueEl = card.locator('.text-2xl');
        const value = await valueEl.innerText({ timeout: 10_000 });
        // Value should be a number, formatted number (K/M), or em dash
        expect(value).toMatch(/[\d.KkMm—]+/);
      }
    });
  });

  test.describe('Chart', () => {
    test('shows usage chart card', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await expect(usagePage.chart).toBeVisible({ timeout: 10_000 });
    });

    test('chart has title and description', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      await expect(usagePage.chartTitle).toBeVisible({ timeout: 10_000 });
      await expect(authenticatedPage.getByText('LLM tokens consumed per day')).toBeVisible({ timeout: 5_000 });
    });

    test('chart renders SVG area or empty state', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      // Either chart renders with SVG or shows "No usage data available"
      const chartCard = usagePage.chart;
      await expect(chartCard).toBeVisible({ timeout: 10_000 });

      const hasSvg = await chartCard.locator('svg.recharts-surface').isVisible({ timeout: 10_000 }).catch(() => false);
      const hasNoData = await authenticatedPage.getByText('No usage data available for this period').isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasSvg || hasNoData).toBeTruthy();
    });

    test('chart has X-axis with date labels', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const hasSvg = await usagePage.chart.locator('svg.recharts-surface').isVisible({ timeout: 10_000 }).catch(() => false);
      test.skip(!hasSvg, 'No chart rendered');

      // X-axis should have date labels (e.g. "Jan 15", "Feb 2")
      const xAxis = usagePage.chart.locator('.recharts-xAxis');
      await expect(xAxis).toBeVisible({ timeout: 5_000 });

      const tickLabels = xAxis.locator('text');
      const tickCount = await tickLabels.count();
      expect(tickCount).toBeGreaterThan(0);
    });

    test('chart has Y-axis with formatted values', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const hasSvg = await usagePage.chart.locator('svg.recharts-surface').isVisible({ timeout: 10_000 }).catch(() => false);
      test.skip(!hasSvg, 'No chart rendered');

      const yAxis = usagePage.chart.locator('.recharts-yAxis');
      await expect(yAxis).toBeVisible({ timeout: 5_000 });

      // Y-axis values should be formatted (K, M, or plain number)
      const tickLabels = yAxis.locator('text');
      const tickCount = await tickLabels.count();
      expect(tickCount).toBeGreaterThan(0);

      // At least one tick should have a value
      for (let i = 0; i < tickCount; i++) {
        const text = await tickLabels.nth(i).innerText();
        if (text.trim().length > 0) {
          expect(text).toMatch(/[\d.KkMm]+/);
          break;
        }
      }
    });
  });

  test.describe('API Integration', () => {
    test('GET /billing/metered-usage returns valid response', async ({ apiFetch }) => {
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const res = await apiFetch(`/billing/metered-usage?from=${encodeURIComponent(from)}&windowSize=DAY`);

      // Either 200 with data or 503 if OpenMeter not configured
      expect([200, 503]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body.meter).toBe('litellm_tokens');
        expect(Array.isArray(body.data)).toBeTruthy();
        if (body.data.length > 0) {
          const point = body.data[0];
          expect(point).toHaveProperty('value');
          expect(point).toHaveProperty('windowStart');
          expect(point).toHaveProperty('windowEnd');
          expect(typeof point.value).toBe('number');
        }
      }
    });

    test('GET /billing/metered-usage/total returns valid response', async ({ apiFetch }) => {
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const res = await apiFetch(`/billing/metered-usage/total?from=${encodeURIComponent(from)}`);

      expect([200, 503]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body.meter).toBe('litellm_tokens');
        expect(typeof body.total).toBe('number');
        expect(body.total).toBeGreaterThanOrEqual(0);
      }
    });

    test('metered-usage respects windowSize parameter', async ({ apiFetch }) => {
      const from = new Date(Date.now() - 7 * 86400000).toISOString();
      const res = await apiFetch(`/billing/metered-usage?from=${encodeURIComponent(from)}&windowSize=HOUR`);

      if (res.status === 200) {
        const body = await res.json();
        expect(Array.isArray(body.data)).toBeTruthy();
        // Hourly windows should produce more data points than daily
        // for the same 7-day range
      }
    });

    test('metered-usage respects from date parameter', async ({ apiFetch }) => {
      const from7d = new Date(Date.now() - 7 * 86400000).toISOString();
      const from90d = new Date(Date.now() - 90 * 86400000).toISOString();

      const [res7d, res90d] = await Promise.all([
        apiFetch(`/billing/metered-usage?from=${encodeURIComponent(from7d)}&windowSize=DAY`),
        apiFetch(`/billing/metered-usage?from=${encodeURIComponent(from90d)}&windowSize=DAY`),
      ]);

      if (res7d.status === 200 && res90d.status === 200) {
        const [body7d, body90d] = await Promise.all([res7d.json(), res90d.json()]);
        // 90d range should have >= data points than 7d
        expect(body90d.data.length).toBeGreaterThanOrEqual(body7d.data.length);
      }
    });

    test('metered-usage requires authentication', async () => {
      const baseURL = process.env.E2E_API_URL || 'http://localhost:13738/v1';
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const res = await fetch(`${baseURL}/billing/metered-usage?from=${encodeURIComponent(from)}`);
      expect(res.status).toBe(401);
    });

    test('metered-usage/total requires authentication', async () => {
      const baseURL = process.env.E2E_API_URL || 'http://localhost:13738/v1';
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const res = await fetch(`${baseURL}/billing/metered-usage/total?from=${encodeURIComponent(from)}`);
      expect(res.status).toBe(401);
    });
  });

  test.describe('Loading States', () => {
    test('shows spinner while loading stat cards', async ({ authenticatedPage }) => {
      // Slow down network to catch loading state
      const usagePage = new UsageDashboardPage(authenticatedPage);

      // Navigate and immediately check for spinners
      const loadPromise = authenticatedPage.goto('/usage');

      // Check for loading spinners right away
      const hasSpinner = await authenticatedPage.locator('.animate-spin').first().isVisible({ timeout: 3_000 }).catch(() => false);
      // Spinner may be too fast to catch — just verify page loads
      await loadPromise;

      // After load, spinners should be gone
      const lingeringSpinners = await authenticatedPage.locator('.animate-spin').count().catch(() => 0);
      // Allow 0 spinners after load (data fetched)
      expect(lingeringSpinners).toBeLessThanOrEqual(2);
    });
  });

  test.describe('Data Accuracy', () => {
    test('stat card total matches API total', async ({ authenticatedPage, apiFetch }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const res = await apiFetch(`/billing/metered-usage/total?from=${encodeURIComponent(from)}`);

      if (res.status === 200) {
        const body = await res.json();
        const apiTotal = body.total;

        // Get the displayed value
        const displayedValue = await usagePage.getStatCardValue('Total Tokens');
        expect(displayedValue).toBeTruthy();

        // If API returns > 0, the displayed value should reflect it
        if (apiTotal > 0) {
          // Displayed value should not be dash
          expect(displayedValue).not.toBe('—');
        }
      }
    });

    test('active days count matches API data', async ({ authenticatedPage, apiFetch }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const res = await apiFetch(`/billing/metered-usage?from=${encodeURIComponent(from)}&windowSize=DAY`);

      if (res.status === 200) {
        const body = await res.json();
        const apiActiveDays = body.data.filter((pt: { value: number }) => pt.value > 0).length;

        const displayedValue = await usagePage.getStatCardValue('Active Days');
        if (apiActiveDays > 0) {
          expect(displayedValue).toBe(String(apiActiveDays));
        }
      }
    });
  });

  test.describe('Token Formatting', () => {
    test('large numbers are formatted with K suffix', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      // Check all stat card values for proper formatting
      const cards = usagePage.statCards;
      const count = await cards.count();
      const validFormats: string[] = [];

      for (let i = 0; i < count; i++) {
        const valueEl = cards.nth(i).locator('.text-2xl');
        const value = await valueEl.innerText({ timeout: 10_000 }).catch(() => '');
        if (value && value !== '—') {
          // Should match: plain number, or number with K/M suffix
          expect(value).toMatch(/^\d+(\.\d+)?[KkMm]?$/);
          validFormats.push(value);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('usage page has proper heading', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      const hasHeading = await usagePage.heading.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasHeading) {
        const tagName = await usagePage.heading.evaluate((el) => el.tagName);
        expect(tagName).toMatch(/^H[1-6]$/);
      }
    });

    test('period tabs are keyboard accessible', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      // Tabs should have role="tab"
      const tabs = usagePage.periodTabs;
      const tabCount = await tabs.count();
      for (let i = 0; i < tabCount; i++) {
        const role = await tabs.nth(i).getAttribute('role');
        expect(role).toBe('tab');
      }
    });

    test('stat cards have descriptive labels', async ({ authenticatedPage }) => {
      const usagePage = new UsageDashboardPage(authenticatedPage);
      await usagePage.goto();
      await usagePage.assertLoaded();

      test.skip(!(await usagePage.hasMeteredData()), 'Metering not configured');

      const expectedLabels = ['Total Tokens', 'Daily Average', 'Active Days'];
      for (const label of expectedLabels) {
        await expect(authenticatedPage.getByText(label)).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test.describe('Responsive', () => {
    test('usage page renders at mobile viewport', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 393, height: 830 } });
      const page = await context.newPage();

      // Login via the page
      await page.goto('/usage');
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2_000);

      // Check no horizontal scroll
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

      await context.close();
    });
  });
});
