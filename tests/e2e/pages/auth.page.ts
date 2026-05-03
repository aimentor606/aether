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
    this.lockScreenHint = page.getByTestId('lock-screen');
    this.lockScreenOverlay = page.getByTestId('lock-screen');
    this.lockScreenButton = page.getByTestId('lock-screen');
    this.heading = page.getByTestId('auth-heading');
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.signInButton = page.getByTestId('sign-in-button');
    // NOTE: errorAlert uses toast role="alert" — no data-testid available on auth page
    this.errorAlert = page.locator('[role="alert"]');
    // NOTE: forgotPasswordLink does not exist in the current auth page (magic link flow)
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
