import { expect, type Locator, type Page } from '@playwright/test';

export class SessionPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly attachButton: Locator;
  readonly messageArea: Locator;
  readonly welcomeState: Locator;
  readonly notFoundState: Locator;
  readonly sidebarNewSessionButton: Locator;
  readonly sessionRows: Locator;
  readonly sessionEmptyState: Locator;
  readonly moreActionsButton: Locator;
  readonly scrollToBottomButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = page.getByTestId('chat-input');
    this.sendButton = page.getByTestId('send-button');
    this.stopButton = page.getByTestId('stop-button');
    this.attachButton = page.getByTestId('attach-button');
    this.messageArea = page.locator('[role="log"]');
    this.welcomeState = page.getByText(/Ask anything/i);
    this.notFoundState = page.getByText(/Session not found/i);
    this.sidebarNewSessionButton = page.getByTestId('new-session-sidebar');
    this.sessionRows = page.locator('a[href^="/sessions/"]');
    this.sessionEmptyState = page.getByTestId('session-empty');
    this.moreActionsButton = page.getByTestId('more-actions');
    this.scrollToBottomButton = page.getByRole('button', { name: /Scroll to bottom/i });
  }

  async goto(sessionId: string) {
    await this.page.goto(`/sessions/${sessionId}`);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async createNewSession(): Promise<string> {
    await this.sidebarNewSessionButton.click();
    await this.page.waitForURL(/\/sessions\/[^/]+/, { timeout: 15_000 });
    const url = this.page.url();
    const match = url.match(/\/sessions\/([^/?]+)/);
    return match?.[1] ?? '';
  }

  async sendMessage(text: string) {
    await this.chatInput.fill(text);
    await this.sendButton.click();
  }

  async typeMessage(text: string) {
    await this.chatInput.focus();
    await this.page.keyboard.type(text);
  }

  async waitForAssistantResponse(timeout = 60_000) {
    await this.page.waitForFunction(
      () => {
        const turns = document.querySelectorAll(`[data-turn-id]`);
        if (turns.length < 2) return false;
        const last = turns[turns.length - 1];
        return last.textContent !== null && last.textContent.length > 0;
      },
      undefined,
      { timeout },
    );
  }

  async getMessageCount(): Promise<number> {
    return this.page.locator('[data-turn-id]').count();
  }

  async getLastUserMessage(): Promise<string> {
    const turns = this.page.locator('[data-turn-id]');
    const count = await turns.count();
    for (let i = count - 1; i >= 0; i--) {
      const el = turns.nth(i);
      const text = await el.textContent();
      if (text && text.trim().length > 0) return text.trim();
    }
    return '';
  }

  async getSessionRows(): Promise<Locator[]> {
    const count = await this.sessionRows.count();
    const rows: Locator[] = [];
    for (let i = 0; i < count; i++) {
      rows.push(this.sessionRows.nth(i));
    }
    return rows;
  }

  async assertChatVisible() {
    await expect(this.chatInput).toBeVisible({ timeout: 15_000 });
  }

  async assertWelcomeState() {
    await expect(this.welcomeState).toBeVisible({ timeout: 10_000 });
  }

  async assertNotFound() {
    await expect(this.notFoundState).toBeVisible({ timeout: 10_000 });
  }
}
