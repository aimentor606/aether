import { expect, type Locator, type Page } from '@playwright/test';

export class ActivateTrialPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subheading: Locator;
  readonly startTrialButton: Locator;
  readonly featuresList: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;
  readonly logoutButton: Locator;
  readonly maintenancePage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Welcome to Aether/i });
    this.subheading = page.getByText(/Start your journey with a 7-day free trial/i);
    this.startTrialButton = page.getByRole('button', { name: /Start 7-Day Free Trial/i });
    this.featuresList = page.getByText(/What's included in trial/i);
    this.termsLink = page.getByRole('link', { name: /Terms of Service/i });
    this.privacyLink = page.getByRole('link', { name: /Privacy Policy/i });
    this.logoutButton = page.getByRole('button', { name: /Log Out/i });
    this.maintenancePage = page.getByText(/Maintenance|Under Maintenance/i);
  }

  async goto() {
    await this.page.goto('/activate-trial');
    await this.heading.waitFor({ timeout: 15_000 }).catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async assertRedirectedAway() {
    await this.page.waitForURL(/\/(dashboard|instances|subscription)/, { timeout: 15_000 });
  }
}

export class CheckoutPage {
  readonly page: Page;
  readonly container: Locator;
  readonly loadingText: Locator;
  readonly errorHeading: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('#checkout-container');
    this.loadingText = page.getByText(/Loading secure checkout/i);
    this.errorHeading = page.getByRole('heading', { name: /Checkout Error/i });
    this.errorAlert = page.getByText(/Unable to load checkout|No checkout session/i);
  }

  async goto(clientSecret?: string) {
    const url = clientSecret ? `/checkout?client_secret=${clientSecret}` : '/checkout';
    await this.page.goto(url);
  }

  async assertLoading() {
    await expect(this.loadingText).toBeVisible({ timeout: 10_000 });
  }

  async assertError() {
    await expect(this.errorHeading).toBeVisible({ timeout: 10_000 });
  }

  async assertNoSessionError() {
    await expect(this.page.getByText(/No checkout session provided/i)).toBeVisible({ timeout: 10_000 });
  }
}

export class NewInstanceModal {
  readonly page: Page;
  readonly heading: Locator;
  readonly chooseMachineLabel: Locator;
  readonly tierOptions: Locator;
  readonly ctaButton: Locator;
  readonly includesSection: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Your Aether/i });
    this.chooseMachineLabel = page.getByText(/Choose your machine/i);
    this.tierOptions = page.locator('[role="radiogroup"] [role="radio"]').or(
      page.locator('button').filter({ hasText: /vCPU/i }),
    );
    this.ctaButton = page.getByRole('button', { name: /Get Your Aether/i });
    this.includesSection = page.getByText(/Every plan includes/i);
    this.closeButton = page.getByRole('button', { name: 'Close' }).or(
      page.locator('button').filter({ has: page.locator('[data-lucide="x"], svg.lucide-x') }),
    );
  }

  async assertVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async selectTier(tierName: string) {
    const option = this.page.locator('[role="radio"]').filter({ hasText: new RegExp(tierName, 'i') }).or(
      this.page.locator('button').filter({ hasText: new RegExp(tierName, 'i') }),
    );
    await option.click();
  }

  async clickCta() {
    await this.ctaButton.click();
  }

  async close() {
    await this.closeButton.first().click();
  }
}

export class CreditPurchaseModal {
  readonly page: Page;
  readonly heading: Locator;
  readonly packageButtons: Locator;
  readonly ctaButton: Locator;
  readonly noSubscriptionText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Buy Credits/i });
    this.packageButtons = page.locator('button').filter({ hasText: /\$\d+.*\d+ credits/i }).or(
      page.locator('[role="dialog"] button').filter({ hasText: /\$/i }),
    );
    this.ctaButton = page.getByRole('button', { name: /Buy \$|Select a package/i });
    this.noSubscriptionText = page.getByText(/Credits Not Available|active subscription/i);
  }

  async assertVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async selectPackage(amount: number) {
    const btn = this.page.locator('[role="dialog"] button, dialog button').filter({ hasText: new RegExp(`\\$${amount}`) });
    await btn.first().click();
  }
}
