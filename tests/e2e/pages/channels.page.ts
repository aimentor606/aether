import { expect, type Locator, type Page } from '@playwright/test';

export class ChannelsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly channelCards: Locator;
  readonly addChannelButton: Locator;
  readonly configDialog: Locator;
  readonly telegramSetupButton: Locator;
  readonly slackSetupButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Channels', { exact: false }).first();
    this.channelCards = page.locator('[class*="spotlight-card"], [class*="bg-card"]').filter({ has: page.locator('h3') });
    this.addChannelButton = page.getByRole('button', { name: /Add Channel/i });
    this.configDialog = page.locator('[role="dialog"]');
    this.telegramSetupButton = page.getByRole('button', { name: /Telegram/i }).or(
      page.locator('button').filter({ hasText: /Connect a Telegram bot/i }),
    );
    this.slackSetupButton = page.getByRole('button', { name: /Slack/i }).or(
      page.locator('button').filter({ hasText: /Connect a Slack app/i }),
    );
    this.emptyState = page.getByText(/No channels yet/i);
  }

  async goto() {
    await this.page.goto('/channels');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}
