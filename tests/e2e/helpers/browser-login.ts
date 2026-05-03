import { expect, type Page } from '@playwright/test';
import { ownerEmail, ownerPassword, apiBase } from './auth';

/**
 * Bootstrap the owner user (idempotent) via API.
 */
export async function bootstrapOwner(page: Page): Promise<void> {
  const res = await page.request.post(`${apiBase}/setup/bootstrap-owner`, {
    data: { email: ownerEmail, password: ownerPassword },
  });
  // 200 = created, 409 = already exists — both fine
  if (res.status() !== 200 && res.status() !== 409) {
    throw new Error(`Bootstrap failed: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Navigate to /auth, dismiss lock screen if present, fill login form, submit.
 * Returns after the login response completes (does not wait for redirect).
 */
export async function loginViaBrowser(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.waitForTimeout(2_000);

  // Dismiss lock screen overlay
  const lockScreen = page.getByText('Click or press Enter to sign in');
  if (await lockScreen.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator('div.fixed.inset-0.cursor-pointer').first().click({ force: true });
    await page.waitForTimeout(1_500);
  }

  // Wait for login form
  await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('input[name="email"]').fill(ownerEmail);
  await page.locator('input[name="password"]').fill(ownerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * Full login + skip onboarding to reach dashboard.
 * Asserts that the dashboard "New session" button is visible.
 */
export async function loginToDashboard(page: Page): Promise<void> {
  await bootstrapOwner(page);
  await loginViaBrowser(page);

  // Wait for post-login state (wizard or dashboard)
  await page.waitForTimeout(5_000);

  // If on onboarding/wizard, skip to dashboard
  const currentUrl = page.url();
  if (currentUrl.includes('/onboarding') || currentUrl.includes('/setup')) {
    await page.goto('/onboarding?skip_onboarding=1');
  }

  // Verify we're on dashboard
  await page.waitForURL(/\/(dashboard)/, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /New session/i })).toBeVisible({
    timeout: 15_000,
  });
}

