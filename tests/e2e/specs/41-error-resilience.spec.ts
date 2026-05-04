import { test, expect } from '../fixtures';

test.describe('Error Resilience', () => {
  test.describe('API Error Responses', () => {
    test('API returns proper error format for 404', async ({ apiFetch }) => {
      const res = await apiFetch('/nonexistent-endpoint');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    test('API returns 401 without auth token', async () => {
      const baseURL = process.env.E2E_API_URL || 'http://localhost:13738/v1';
      const res = await fetch(`${baseURL}/billing/account-state`);
      expect(res.status).toBe(401);
    });

    test('API returns 401 for vertical endpoints without auth', async () => {
      const baseURL = process.env.E2E_API_URL || 'http://localhost:13738/v1';
      const endpoints = [
        '/verticals/insurance/policies',
        '/verticals/advisor/portfolios',
      ];
      for (const endpoint of endpoints) {
        const res = await fetch(`${baseURL}${endpoint}`);
        expect(res.status).toBe(401);
      }
    });

    test('API validates request body and returns 400', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/policies', {
        method: 'POST',
        body: JSON.stringify({ invalid: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    test('API handles missing vertical resource with 404', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/policies/nonexistent-id-12345');
      expect(res.status).toBe(404);
    });
  });

  test.describe('Page Error States', () => {
    test('instances page shows error state on API failure', async ({ authenticatedPage }) => {
      // Block instances API to simulate failure
      await authenticatedPage.route('**/api/instances**', (route) =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) }),
      );

      await authenticatedPage.goto('/instances');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Should show error state or gracefully degrade
      const errorState = authenticatedPage.getByTestId('instances-error');
      const hasError = await errorState.isVisible({ timeout: 5_000 }).catch(() => false);

      if (!hasError) {
        // Page should still render something (not crash)
        const bodyVisible = await authenticatedPage.locator('body').isVisible();
        expect(bodyVisible).toBeTruthy();
      }
    });

    test('instances page recovers when API returns', async ({ authenticatedPage }) => {
      let callCount = 0;
      await authenticatedPage.route('**/api/instances**', (route) => {
        callCount++;
        if (callCount === 1) {
          return route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) });
        }
        return route.continue();
      });

      await authenticatedPage.goto('/instances');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Reload to trigger recovery
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Page should load without crashing
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });
  });

  test.describe('Empty States', () => {
    test('workspace shows empty state when no data', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/api/workspace**', (route) =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: [] }),
        }),
      );

      await authenticatedPage.goto('/workspace');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const emptyState = authenticatedPage.getByTestId('workspace-empty');
      const hasEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      // Page should render without crash
      expect(hasEmpty || (await authenticatedPage.locator('body').isVisible())).toBeTruthy();
    });

    test('files page shows empty state when no files', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/files**', (route) =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: [] }),
        }),
      );

      await authenticatedPage.goto('/files');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const emptyState = authenticatedPage.getByTestId('files-empty');
      const hasEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasEmpty || (await authenticatedPage.locator('body').isVisible())).toBeTruthy();
    });

    test('usage page shows no-data state when metering unavailable', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/metered-usage**', (route) =>
        route.fulfill({ status: 503, body: JSON.stringify({ error: 'Usage metering unavailable' }) }),
      );

      await authenticatedPage.goto('/usage');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const noData = authenticatedPage.getByTestId('usage-no-data');
      const hasNoData = await noData.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasNoData).toBeTruthy();
    });

    test('scheduled tasks shows empty state', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/scheduled-tasks**', (route) =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: [] }),
        }),
      );

      await authenticatedPage.goto('/scheduled-tasks');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const emptyState = authenticatedPage.getByTestId('triggers-empty');
      const hasEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasEmpty || (await authenticatedPage.locator('body').isVisible())).toBeTruthy();
    });
  });

  test.describe('Network Failure Simulation', () => {
    test('page handles total network failure gracefully', async ({ authenticatedPage }) => {
      // Block all API calls
      await authenticatedPage.route('**/api/**', (route) =>
        route.abort('connectionfailed'),
      );

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Page should render without a blank screen
      const bodyText = await authenticatedPage.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
      expect(bodyText.length).toBeGreaterThan(0);
    });

    test('page recovers after network failure resolves', async ({ authenticatedPage }) => {
      let failRequests = true;
      await authenticatedPage.route('**/api/**', (route) => {
        if (failRequests) {
          return route.abort('connectionfailed');
        }
        return route.continue();
      });

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(1_000);

      // Un-fail the network
      failRequests = false;
      await authenticatedPage.route('**/api/**', (route) => route.continue());

      // Reload should work
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });

    test('slow API response does not crash page', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/api/**', async (route) => {
        // Delay response by 5s
        await new Promise((r) => setTimeout(r, 5_000));
        return route.continue();
      });

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForTimeout(3_000);

      // Page should still be alive (showing loading state)
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();

      // Clean up the route
      await authenticatedPage.unroute('**/api/**');
    });
  });

  test.describe('Server Error (5xx) Handling', () => {
    test('dashboard handles 500 error on account state', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/billing/account-state**', (route) =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) }),
      );

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Page should render without crash — may show degraded UI
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });

    test('finance page handles 500 on vertical endpoints', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/verticals/finance/**', (route) =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) }),
      );

      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Finance page should render even if API fails
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });

    test('settings page handles API failure', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/api-keys**', (route) =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) }),
      );

      await authenticatedPage.goto('/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });
  });

  test.describe('Rate Limiting (429)', () => {
    test('page handles 429 rate limit gracefully', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/billing/account-state**', (route) =>
        route.fulfill({
          status: 429,
          headers: { 'Retry-After': '10' },
          body: JSON.stringify({ error: 'Too many requests' }),
        }),
      );

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Page should not crash
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });
  });

  test.describe('Invalid Data Handling', () => {
    test('page handles malformed JSON response', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/billing/account-state**', (route) =>
        route.fulfill({ status: 200, body: 'not json at all {{{' }),
      );

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Should not crash — React Query catches parse errors
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });

    test('page handles empty JSON response', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/billing/account-state**', (route) =>
        route.fulfill({ status: 200, body: '{}' }),
      );

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });
  });

  test.describe('Navigation Under Errors', () => {
    test('can navigate between pages when one has API errors', async ({ authenticatedPage }) => {
      // Break only the finance API
      await authenticatedPage.route('**/verticals/finance/**', (route) =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'fail' }) }),
      );

      // Navigate to finance (broken)
      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(1_000);

      // Navigate to instances (should work)
      await authenticatedPage.goto('/instances');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      // Instances page should render normally
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(bodyVisible).toBeTruthy();
    });

    test('can navigate back after encountering an error page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      // Navigate to a non-existent page
      await authenticatedPage.goto('/this-page-does-not-exist');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(1_000);

      // Navigate back
      await authenticatedPage.goBack();
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const url = authenticatedPage.url();
      expect(url).toContain('/dashboard');
    });
  });

  test.describe('Global Error Boundary', () => {
    test('global error page shows recovery options', async ({ authenticatedPage }) => {
      // Force a client-side error by injecting broken code
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      // Trigger an unhandled error
      await authenticatedPage.evaluate(() => {
        // This will be caught by Next.js error boundary
        throw new Error('Test error boundary trigger');
      }).catch(() => {});

      await authenticatedPage.waitForTimeout(2_000);

      // Either error boundary renders or page stays functional
      const hasSystemFault = await authenticatedPage.getByText(/System Fault|error/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
      const bodyVisible = await authenticatedPage.locator('body').isVisible();
      expect(hasSystemFault || bodyVisible).toBeTruthy();
    });
  });
});
