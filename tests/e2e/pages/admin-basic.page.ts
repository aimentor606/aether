import { expect, type Locator, type Page } from '@playwright/test';

export class AdminAccessRequestsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly summaryCards: Locator;
  readonly tabs: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-access-requests-heading');
    this.summaryCards = page.getByTestId('access-summary-card');
    this.tabs = page.locator('[role="tablist"] [role="tab"]');
    this.table = page.getByTestId('access-requests-table');
    this.tableRows = page.locator('tbody > tr');
  }

  async goto() {
    await this.page.goto('/admin/access-requests');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async switchTab(tab: string) {
    await this.page.locator('[role="tablist"] [role="tab"]', { hasText: tab }).click();
  }
}

export class AdminFeatureFlagsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addFlagButton: Locator;
  readonly refreshButton: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly createDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-feature-flags-heading');
    this.addFlagButton = page.getByTestId('add-flag-button');
    this.refreshButton = page.getByTestId('refresh-flags-button');
    this.table = page.getByTestId('feature-flags-table');
    this.tableRows = page.locator('tbody > tr');
    this.createDialog = page.getByTestId('create-flag-dialog');
  }

  async goto() {
    await this.page.goto('/admin/feature-flags');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}

export class AdminLiteLLMPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly statusCards: Locator;
  readonly modelCatalog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-litellm-heading');
    this.statusCards = page.getByTestId('litellm-status-card');
    this.modelCatalog = page.getByTestId('model-catalog-table');
  }

  async goto() {
    await this.page.goto('/admin/litellm');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}

export class AdminNotificationsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly sendButton: Locator;
  readonly broadcastSwitch: Locator;
  readonly workflowSelect: Locator;
  readonly payloadTextarea: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-notifications-heading');
    this.sendButton = page.getByTestId('send-notification-button');
    this.broadcastSwitch = page.getByTestId('broadcast-switch');
    this.workflowSelect = page.getByTestId('workflow-select');
    this.payloadTextarea = page.getByTestId('notification-payload');
  }

  async goto() {
    await this.page.goto('/admin/notifications');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}

export class AdminUtilsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly maintenanceCard: Locator;
  readonly technicalIssueCard: Locator;
  readonly maintenanceDialog: Locator;
  readonly technicalIssueDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-utils-heading');
    this.maintenanceCard = page.getByTestId('maintenance-card');
    this.technicalIssueCard = page.getByTestId('technical-issue-card');
    this.maintenanceDialog = page.getByTestId('maintenance-dialog');
    this.technicalIssueDialog = page.getByTestId('technical-issue-dialog');
  }

  async goto() {
    await this.page.goto('/admin/utils');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}

export class AdminFeedbackPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tabs: Locator;
  readonly statsCards: Locator;
  readonly feedbackTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-feedback-heading');
    this.tabs = page.locator('[role="tablist"] [role="tab"]');
    this.statsCards = page.getByTestId('feedback-stats-card');
    this.feedbackTable = page.getByTestId('admin-feedback-table');
  }

  async goto() {
    await this.page.goto('/admin/feedback');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async switchTab(tab: string) {
    await this.page.locator('[role="tablist"] [role="tab"]', { hasText: tab }).click();
  }
}
