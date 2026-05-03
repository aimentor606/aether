import { type Locator, type Page, expect } from '@playwright/test';

// ─── AdminAnalyticsPage ──────────────────────────────────────────────────────

export class AdminAnalyticsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly datePresets: Locator;
  readonly tabs: Locator;
  readonly statCards: Locator;
  readonly financialsSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-analytics-heading');
    this.datePresets = page.getByTestId('date-presets');
    this.tabs = page.locator('[role="tablist"] > [role="tab"]');
    this.statCards = page.getByTestId('analytics-stat-card');
    this.financialsSection = page.getByTestId('financials-section');
  }

  async goto() {
    await this.page.goto('/admin/analytics');
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async switchTab(tab: string) {
    await this.page
      .locator('[role="tablist"] > [role="tab"]')
      .filter({ hasText: tab })
      .click();
  }
}

// ─── AdminSandboxPoolPage ────────────────────────────────────────────────────

export class AdminSandboxPoolPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly healthBadge: Locator;
  readonly statCards: Locator;
  readonly quickActions: Locator;
  readonly replenishButton: Locator;
  readonly cleanupButton: Locator;
  readonly restartButton: Locator;
  readonly forceCreateInput: Locator;
  readonly forceCreateButton: Locator;
  readonly sandboxList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-sandbox-pool-heading');
    this.healthBadge = page.getByTestId('pool-health-badge');
    this.statCards = page.getByTestId('pool-stat-card');
    this.quickActions = page.getByTestId('quick-actions');
    this.replenishButton = page.getByTestId('replenish-button');
    this.cleanupButton = page.getByTestId('cleanup-button');
    this.restartButton = page.getByTestId('restart-button');
    this.forceCreateInput = page.getByTestId('force-create-input');
    this.forceCreateButton = page.getByTestId('force-create-button');
    this.sandboxList = page.getByTestId('pooled-sandboxes');
  }

  async goto() {
    await this.page.goto('/admin/sandbox-pool');
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}

// ─── AdminSandboxesPage ──────────────────────────────────────────────────────

export class AdminSandboxesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tabs: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly refreshButton: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-sandboxes-heading');
    this.tabs = page.locator('[role="tablist"] > [role="tab"]');
    this.searchInput = page.getByTestId('sandbox-search');
    this.statusFilter = page.getByTestId('sandbox-status-filter');
    this.refreshButton = page.getByTestId('sandbox-refresh-button');
    this.table = page.getByTestId('sandboxes-table');
    this.tableRows = page.locator('tbody > tr');
  }

  async goto() {
    await this.page.goto('/admin/sandboxes');
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async switchTab(tab: string) {
    await this.page
      .locator('[role="tablist"] > [role="tab"]')
      .filter({ hasText: tab })
      .click();
  }
}

// ─── AdminStatelessPage ──────────────────────────────────────────────────────

export class AdminStatelessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly healthBadges: Locator;
  readonly quickActions: Locator;
  readonly statCards: Locator;
  readonly tabs: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-stateless-heading');
    this.healthBadges = page.getByTestId('health-badges');
    this.quickActions = page.getByTestId('stateless-quick-actions');
    this.statCards = page.getByTestId('stateless-stat-card');
    this.tabs = page.locator('[role="tablist"] > [role="tab"]');
  }

  async goto() {
    await this.page.goto('/admin/stateless');
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async switchTab(tab: string) {
    await this.page
      .locator('[role="tablist"] > [role="tab"]')
      .filter({ hasText: tab })
      .click();
  }
}

// ─── AdminStressTestPage ─────────────────────────────────────────────────────

export class AdminStressTestPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly requestCountInput: Locator;
  readonly startButton: Locator;
  readonly stopButton: Locator;
  readonly resetButton: Locator;
  readonly resultsTable: Locator;
  readonly summaryCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('admin-stress-test-heading');
    this.requestCountInput = page.getByTestId('request-count-input');
    this.startButton = page.getByTestId('start-test-button');
    this.stopButton = page.getByTestId('stop-test-button');
    this.resetButton = page.getByTestId('reset-button');
    this.resultsTable = page.getByTestId('stress-test-results');
    this.summaryCard = page.getByTestId('stress-test-summary');
  }

  async goto() {
    await this.page.goto('/admin/stress-test');
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}
