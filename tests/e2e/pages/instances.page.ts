import { expect, type Locator, type Page } from '@playwright/test';

export class InstancesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newInstanceButton: Locator;
  readonly instanceCards: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;
  readonly retryButton: Locator;
  readonly settingsButton: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Instances' });
    this.newInstanceButton = page.getByRole('button', { name: /New Aether/i });
    this.instanceCards = page.locator('button[class*="rounded"]').filter({ has: page.locator('[class*="font-semibold"]') });
    this.emptyState = page.getByText(/No instances yet/i);
    this.errorState = page.getByText(/Failed to load instances/i);
    this.retryButton = page.getByRole('button', { name: /Retry/i });
    this.settingsButton = page.getByRole('button', { name: /Settings/i });
    this.logoutButton = page.getByRole('button', { name: /Log Out/i });
  }

  async goto() {
    await this.page.goto('/instances');
    await this.heading.waitFor({ timeout: 30_000 });
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async getInstanceCardByName(name: string): Promise<Locator> {
    return this.page.locator('button').filter({ hasText: new RegExp(name, 'i') }).first();
  }

  async getInstanceCount(): Promise<number> {
    if (await this.emptyState.isVisible({ timeout: 3_000 }).catch(() => false)) return 0;
    return this.instanceCards.count();
  }

  async clickInstance(name?: string): Promise<void> {
    if (name) {
      const card = await this.getInstanceCardByName(name);
      await card.click();
    } else {
      await this.instanceCards.first().click();
    }
  }

  async getVisibleStatuses(): Promise<string[]> {
    const statuses: string[] = [];
    const statusElements = this.page.locator('[class*="rounded-full"]').filter({ hasText: /Active|Provisioning|Stopped|Error|Available/i });
    const count = await statusElements.count();
    for (let i = 0; i < count; i++) {
      statuses.push((await statusElements.nth(i).textContent())?.trim() ?? '');
    }
    return statuses;
  }
}

export class InstanceDetailPage {
  readonly page: Page;
  readonly backButton: Locator;
  readonly title: Locator;
  readonly provisioningTitle: Locator;
  readonly healthCheckTitle: Locator;
  readonly errorTitle: Locator;
  readonly stoppedTitle: Locator;
  readonly backToInstancesButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.getByRole('button', { name: /Instances/i }).first();
    this.title = page.getByRole('heading').first();
    this.provisioningTitle = page.getByText(/Creating Workspace/i);
    this.healthCheckTitle = page.getByText(/Pinging Sandbox/i);
    this.errorTitle = page.getByText(/Something went wrong/i);
    this.stoppedTitle = page.getByText(/Instance Stopped/i);
    this.backToInstancesButton = page.getByRole('button', { name: /Back to Instances/i });
  }

  async goto(instanceId: string) {
    await this.page.goto(`/instances/${instanceId}`);
  }

  async waitForRedirect(timeout = 60_000): Promise<string> {
    await this.page.waitForURL(/\/instances\/[^/]+\/(dashboard|agents|sessions)/, { timeout });
    return this.page.url();
  }

  async assertProvisioning() {
    await expect(this.provisioningTitle).toBeVisible({ timeout: 15_000 });
  }

  async assertError() {
    await expect(this.errorTitle).toBeVisible({ timeout: 15_000 });
  }

  async assertStopped() {
    await expect(this.stoppedTitle).toBeVisible({ timeout: 15_000 });
  }

  async goBack() {
    await this.backButton.click();
    await this.page.waitForURL(/\/instances$/);
  }
}

export class InstanceBackupsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly backButton: Locator;
  readonly descriptionInput: Locator;
  readonly backupNowButton: Locator;
  readonly emptyState: Locator;
  readonly backupRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Backups/i });
    this.backButton = page.getByRole('button', { name: /Instances/i });
    this.descriptionInput = page.locator('input[placeholder*="Backup description"]');
    this.backupNowButton = page.getByRole('button', { name: /Backup Now/i });
    this.emptyState = page.getByText(/No backups yet/i);
    this.backupRows = page.locator('[class*="border"]').filter({ hasText: /Backup|available/i });
  }

  async goto(instanceId: string) {
    await this.page.goto(`/instances/${instanceId}/backups`);
    await this.heading.waitFor({ timeout: 15_000 });
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async createBackup(description?: string) {
    if (description) {
      await this.descriptionInput.fill(description);
    }
    await this.backupNowButton.click();
  }

  async getBackupCount(): Promise<number> {
    if (await this.emptyState.isVisible({ timeout: 3_000 }).catch(() => false)) return 0;
    return this.backupRows.count();
  }
}
