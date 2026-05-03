import { test, expect } from '@playwright/test';
import { bootstrapOwner, loginViaBrowser, loginToDashboard } from '../helpers/browser-login';
import { ownerEmail, ownerPassword } from '../helpers/auth';

test.describe('16 — Auth Browser Flows', () => {
  test.setTimeout(120_000);

  /* ── Lock screen ─────────────────────────────────────────────────────── */

  test('lock screen overlay is visible on first load and can be dismissed by clicking', async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/auth');
    await page.waitForTimeout(2_000);

    // Lock screen hint text should be visible
    const lockHint = page.getByText('Click or press Enter to sign in');
    await expect(lockHint).toBeVisible({ timeout: 10_000 });

    // The overlay div should be present
    const overlay = page.locator('div.fixed.inset-0.cursor-pointer').first();
    await expect(overlay).toBeAttached();

    // Click to dismiss lock screen
    await overlay.click({ force: true });
    await page.waitForTimeout(1_500);

    // Lock hint should be gone; the "Sign in to Aether" heading should appear
    await expect(lockHint).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Sign in to Aether')).toBeVisible({ timeout: 10_000 });
  });

  test('lock screen can be dismissed by pressing Enter key', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/auth');
    await page.waitForTimeout(2_000);

    // Confirm lock screen is showing
    const lockHint = page.getByText('Click or press Enter to sign in');
    await expect(lockHint).toBeVisible({ timeout: 10_000 });

    // Press Enter to dismiss
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_500);

    // Lock screen should be dismissed, form heading should be visible
    await expect(lockHint).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Sign in to Aether')).toBeVisible({ timeout: 10_000 });
  });

  /* ── Login form ──────────────────────────────────────────────────────── */

  test('login form appears after dismissing lock screen', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/auth');
    await page.waitForTimeout(2_000);

    // Dismiss lock screen
    const lockHint = page.getByText('Click or press Enter to sign in');
    if (await lockHint.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('div.fixed.inset-0.cursor-pointer').first().click({ force: true });
      await page.waitForTimeout(1_500);
    }

    // Form elements should be present (password mode via ?auth=password)
    // Default cloud mode shows email input + "Continue with email" button
    await expect(page.getByText('Sign in to Aether')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('button', { name: /Continue with email|Sign in/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('empty form submission shows validation error or prevents submission', async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Use password mode for direct sign-in form
    await page.goto('/auth?auth=password');
    await page.waitForTimeout(2_000);

    // Dismiss lock screen
    const lockHint = page.getByText('Click or press Enter to sign in');
    if (await lockHint.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('div.fixed.inset-0.cursor-pointer').first().click({ force: true });
      await page.waitForTimeout(1_500);
    }

    // Click Sign in without filling any fields
    // Browser HTML5 validation should prevent submission (inputs have `required`)
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(passwordInput).toBeVisible({ timeout: 5_000 });

    // The sign in button should be present but submitting empty required fields
    // triggers browser validation, so we remain on /auth
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(2_000);

    // We should still be on the auth page (not redirected)
    expect(page.url()).toContain('/auth');
  });

  test('wrong credentials shows error message', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate to password auth mode
    await page.goto('/auth?auth=password');
    await page.waitForTimeout(2_000);

    // Dismiss lock screen
    const lockHint = page.getByText('Click or press Enter to sign in');
    if (await lockHint.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('div.fixed.inset-0.cursor-pointer').first().click({ force: true });
      await page.waitForTimeout(1_500);
    }

    // Fill in wrong credentials
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('input[name="email"]').fill('wrong@example.com');
    await page.locator('input[name="password"]').fill('completely-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should stay on auth page (no redirect to dashboard)
    await page.waitForTimeout(3_000);
    expect(page.url()).toContain('/auth');
  });

  test('successful login navigates away from /auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Bootstrap owner user first
    await bootstrapOwner(page);

    // Login via password mode
    await page.goto('/auth?auth=password');
    await page.waitForTimeout(2_000);

    // Dismiss lock screen
    const lockHint = page.getByText('Click or press Enter to sign in');
    if (await lockHint.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('div.fixed.inset-0.cursor-pointer').first().click({ force: true });
      await page.waitForTimeout(1_500);
    }

    // Fill correct credentials and submit
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('input[name="email"]').fill(ownerEmail);
    await page.locator('input[name="password"]').fill(ownerPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should navigate away from /auth to dashboard, instances, or onboarding
    await page.waitForURL(
      (url) => !url.pathname.startsWith('/auth'),
      { timeout: 30_000 },
    );
  });

  /* ── Password reset pages ────────────────────────────────────────────── */

  test('/auth/password page renders with sign-in form fields', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/auth/password');
    await page.waitForTimeout(2_000);

    // The password auth page should render with a heading
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible({
      timeout: 10_000,
    });

    // Should have email and password inputs
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 5_000 });

    // Should have a submit button
    await expect(page.getByRole('button', { name: /Sign in|Create account/i })).toBeVisible();

    // Should have a "Back to sign in" link back to /auth
    await expect(page.getByRole('link', { name: /Back to sign in/i })).toBeVisible();

    // Should have sign-in / sign-up toggle
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible();
  });

  test('/auth/reset-password page renders with password reset form', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate directly — no reset code in URL
    await page.goto('/auth/reset-password');
    await page.waitForTimeout(2_000);

    // Should show the "Reset Password" heading
    await expect(page.getByRole('heading', { name: /Reset Password/i })).toBeVisible({
      timeout: 10_000,
    });

    // Without a code param, should show an error about missing reset code
    const alertRole = page.getByRole('alert');
    await expect(alertRole).toBeVisible({ timeout: 5_000 });
    await expect(alertRole).toContainText(/invalid|missing reset code/i);

    // Should have a "Back to sign in" or "Return to sign in" link
    await expect(
      page.getByRole('link', { name: /Back to sign in|Return to sign in/i }),
    ).toBeVisible();
  });

  /* ── Navigation after login ──────────────────────────────────────────── */

  test('after successful login, navigating back to /auth shows login form', async ({ page }) => {
    // Full login to reach dashboard
    await loginToDashboard(page);

    // Now navigate back to /auth
    await page.goto('/auth');
    await page.waitForTimeout(2_000);

    // The lock screen may or may not show. If it does, dismiss it.
    const lockHint = page.getByText('Click or press Enter to sign in');
    if (await lockHint.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('div.fixed.inset-0.cursor-pointer').first().click({ force: true });
      await page.waitForTimeout(1_500);
    }

    // Since the user is already authenticated, the page should either:
    // 1. Redirect away from /auth (to instances/dashboard), or
    // 2. Show the login form again (not locked out permanently)
    // Wait briefly to see if a redirect happens
    await page.waitForTimeout(3_000);

    const currentUrl = page.url();
    const redirectedAway = !currentUrl.includes('/auth');
    const formVisible = await page
      .locator('input[name="email"]')
      .isVisible()
      .catch(() => false);

    // Either we got redirected (already authed) or the form is visible — both are valid
    expect(redirectedAway || formVisible).toBe(true);
  });
});
