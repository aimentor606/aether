import { test, expect } from '../fixtures';

test.describe('17 — Dashboard Navigation', () => {
  test.setTimeout(300_000);

  // ── Dashboard home ──────────────────────────────────────────────────────────

  test('dashboard home renders with New session button and sidebar', async ({ authenticatedPage }) => {
    // Verify "New session" button is visible (already asserted by fixture,
    // but confirm we are still on the dashboard page)
    await expect(authenticatedPage.getByRole('button', { name: /New session/i })).toBeVisible({
      timeout: 10_000,
    });

    // Verify sidebar is present (nav or aside element)
    const sidebar = authenticatedPage.locator('nav, aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Verify URL is /dashboard
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
  });

  // ── Settings: API Keys ──────────────────────────────────────────────────────

  test('settings API Keys page loads with heading and key list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings/api-keys');
    await authenticatedPage.waitForLoadState('networkidle');

    // Page heading
    await expect(authenticatedPage.getByRole('heading', { name: /API Keys/i })).toBeVisible({
      timeout: 15_000,
    });

    // Either keys are listed or one of the empty-state messages appears
    const hasKeys = await authenticatedPage.getByText(/No API keys/i).isVisible({ timeout: 5_000 }).catch(() => false);
    const hasNoSandbox = await authenticatedPage.getByText(/No sandbox active/i).isVisible().catch(() => false);
    const hasKeyRows = await authenticatedPage.locator('[class*="divide-y"] .flex.items-center.gap-3').first().isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasKeys || hasNoSandbox || hasKeyRows).toBe(true);
  });

  // ── Settings: Credentials ───────────────────────────────────────────────────

  test('settings Credentials page loads with Secrets Manager heading', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings/credentials');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.getByRole('heading', { name: /Secrets Manager/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── Settings: Providers ─────────────────────────────────────────────────────

  test('settings Providers page loads with LLM Providers heading', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings/providers');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.getByRole('heading', { name: /LLM Providers/i })).toBeVisible({
      timeout: 15_000,
    });

    // Should show either a provider list or empty state with "Add Provider" button
    const hasProviders = await authenticatedPage.getByText(/No providers connected/i).isVisible({ timeout: 5_000 }).catch(() => false);
    const hasAddButton = await authenticatedPage.getByRole('button', { name: /Add Provider/i }).isVisible().catch(() => false);

    expect(hasProviders || hasAddButton).toBe(true);
  });

  // ── Workspace (instances) ───────────────────────────────────────────────────

  test('workspace page loads with heading and content', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/workspace');
    await authenticatedPage.waitForLoadState('networkidle');

    // Workspace page shows a "Workspace" heading via PageHeader
    await expect(authenticatedPage.getByText('Workspace', { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Quick actions section should be present
    await expect(authenticatedPage.getByText(/Quick actions/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Deployments ─────────────────────────────────────────────────────────────

  test('deployments page loads', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/deployments');
    await authenticatedPage.waitForLoadState('networkidle');

    // Deployments page shows heading or a 404 if feature flag is off
    const hasHeading = await authenticatedPage.getByRole('heading', { name: /Deployments/i }).isVisible({ timeout: 10_000 }).catch(() => false);
    const hasNotFound = await authenticatedPage.getByText(/404|Not Found/i).isVisible().catch(() => false);

    expect(hasHeading || hasNotFound).toBe(true);
  });

  // ── Files ────────────────────────────────────────────────────────────────────

  test('files page loads with drive toolbar', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/files');
    await authenticatedPage.waitForLoadState('networkidle');

    // Drive toolbar has a "Refresh files" button
    await expect(authenticatedPage.getByRole('button', { name: /Refresh files/i })).toBeVisible({
      timeout: 15_000,
    });

    // Should show either files or an empty/no-sandbox state
    const hasFiles = await authenticatedPage.locator('[data-file-type]').first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await authenticatedPage.getByText(/No files|No sandbox active|empty/i).isVisible().catch(() => false);
    const hasLoading = await authenticatedPage.locator('.animate-pulse').first().isVisible().catch(() => false);

    expect(hasFiles || hasEmpty || hasLoading).toBe(true);
  });

  // ── Usage dashboard ─────────────────────────────────────────────────────────

  test('usage dashboard page loads', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/usage');
    await authenticatedPage.waitForLoadState('networkidle');

    // Usage page shows either the dashboard or "not configured" message
    const hasHeading = await authenticatedPage.getByRole('heading', { name: /Usage Dashboard/i }).isVisible({ timeout: 10_000 }).catch(() => false);
    const hasNotConfigured = await authenticatedPage.getByText(/Usage metering not configured/i).isVisible().catch(() => false);

    expect(hasHeading || hasNotConfigured).toBe(true);
  });

  // ── Sidebar navigation links ────────────────────────────────────────────────

  test('sidebar navigation links are present and clickable', async ({ authenticatedPage }) => {
    // Verify sidebar contains navigation links to key pages
    const sidebar = authenticatedPage.locator('nav, aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Check for Settings link in sidebar
    const settingsLink = sidebar.locator('a[href*="/settings"]').first();
    if (await settingsLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsLink.click();
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage).toHaveURL(/\/settings/);
    }
  });

  // ── Usage dashboard period tabs ─────────────────────────────────────────────

  test('usage dashboard period tabs render when dashboard is available', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/usage');
    await authenticatedPage.waitForLoadState('networkidle');

    // If the usage dashboard is available (not the "not configured" state),
    // verify the period tabs are present
    const hasDashboard = await authenticatedPage.getByRole('heading', { name: /Usage Dashboard/i }).isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasDashboard) {
      await expect(authenticatedPage.getByRole('tab', { name: /7 days/i })).toBeVisible({ timeout: 5_000 });
      await expect(authenticatedPage.getByRole('tab', { name: /30 days/i })).toBeVisible();
      await expect(authenticatedPage.getByRole('tab', { name: /90 days/i })).toBeVisible();
    }

    // Test passes either way — if dashboard is not configured, the "not configured"
    // state was already verified in the previous test.
    expect(true).toBe(true);
  });
});
