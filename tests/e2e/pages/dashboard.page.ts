import { expect, type Locator, type Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly newSessionButton: Locator;
  readonly sidebar: Locator;
  readonly sidebarNav: Locator;
  readonly sidebarLinks: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    // TODO: "New session" button has no dedicated element in DashboardContent —
    // sessions are created via SessionChatInput's send handler. Using chat input
    // area as a proxy until an explicit button is added.
    this.newSessionButton = page.getByRole('button', { name: /New session/i });
    this.sidebar = page.getByTestId('dashboard-sidebar');
    this.sidebarNav = page.locator('nav').first();
    this.sidebarLinks = page.locator('nav a, nav button');
    this.heading = page.locator('h1, h2, h3').first();
  }

  async goto() {
    await this.page.goto('/dashboard');
    await expect(this.sidebar).toBeVisible({ timeout: 15_000 });
  }

  async assertLoaded() {
    await expect(this.sidebar).toBeVisible({ timeout: 15_000 });
  }

  async assertSidebarVisible() {
    await expect(this.sidebar).toBeVisible();
  }

  async navigateTo(path: string) {
    await this.page.goto(path);
  }

  async getSidebarLinkCount() {
    return this.sidebarLinks.count();
  }
}
