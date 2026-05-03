import { expect, type Locator, type Page } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  readonly lockScreenHint: Locator;
  readonly lockScreenOverlay: Locator;
  readonly lockScreenButton: Locator;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly errorAlert: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.lockScreenHint = page.getByText('Click or press Enter to sign in');
    this.lockScreenOverlay = page.locator('div.fixed.inset-0.cursor-pointer').first();
    this.lockScreenButton = page.locator(
      'div.fixed.inset-0.cursor-pointer[role="button"]',
    ).first();
    this.heading = page.getByRole('heading', { name: /Sign in/i });
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.errorAlert = page.locator('[role="alert"]');
    this.forgotPasswordLink = page.getByRole('link', { name: /Forgot password/i });
  }

  async goto() {
    await this.page.goto('/auth');
    await this.page.waitForTimeout(2_000);
  }

  async dismissLockScreen() {
    if (await this.lockScreenHint.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await this.lockScreenOverlay.click({ force: true });
      await this.page.waitForTimeout(1_500);
    }
  }

  async waitForForm() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async fillCredentials(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async signIn() {
    await this.signInButton.click();
  }

  async login(email: string, password: string) {
    await this.goto();
    await this.dismissLockScreen();
    await this.waitForForm();
    await this.fillCredentials(email, password);
    await this.signIn();
  }

  async assertErrorVisible() {
    await expect(this.errorAlert).toBeVisible({ timeout: 5_000 });
  }

  async assertNavigatedAway() {
    await expect(this.page).not.toHaveURL(/\/auth$/, { timeout: 15_000 });
  }
}
