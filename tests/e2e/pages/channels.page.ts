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
    this.heading = page.getByTestId('channels-heading');
    this.channelCards = page.getByTestId('channel-card');
    this.addChannelButton = page.getByTestId('add-channel-button');
    this.configDialog = page.locator('[role="dialog"]');
    this.telegramSetupButton = page.getByTestId('telegram-setup');
    this.slackSetupButton = page.getByTestId('slack-setup');
    this.emptyState = page.getByTestId('channels-empty');
  }

  async goto() {
    await this.page.goto('/channels');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}
