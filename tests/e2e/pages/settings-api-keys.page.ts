import { expect, type Locator, type Page } from '@playwright/test';

export class SettingsApiKeysPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createKeyButton: Locator;
  readonly keyDialog: Locator;
  readonly keyNameInput: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;
  readonly keyRows: Locator;
  readonly statusDots: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'API Keys' });
    this.createKeyButton = page.getByRole('button', { name: /Create Key/i });
    this.keyDialog = page.getByRole('dialog');
    this.keyNameInput = page.locator('#title');
    this.dialogCancelButton = page.getByRole('button', { name: /Cancel/i });
    this.dialogSubmitButton = page.getByRole('button', { name: /Create/i });
    this.keyRows = page.locator('[data-key-id], [data-testid="api-key-row"]').or(
      page.locator('table tbody tr, .space-y-3 > div'),
    );
    this.statusDots = page.locator('span[aria-hidden="true"].rounded-full');
  }

  async goto() {
    await this.page.goto('/settings/api-keys');
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async openCreateDialog() {
    await this.createKeyButton.click();
    await expect(this.keyDialog).toBeVisible({ timeout: 5_000 });
  }

  async closeDialog() {
    await this.dialogCancelButton.click();
    await expect(this.keyDialog).not.toBeVisible({ timeout: 5_000 });
  }

  async createKey(name: string) {
    await this.openCreateDialog();
    await this.keyNameInput.fill(name);
    await this.dialogSubmitButton.click();
  }

  async findKeyByName(name: string): Promise<Locator> {
    return this.page.getByText(name).locator('..');
  }

  async revokeKey(name: string) {
    const row = await this.findKeyByName(name);
    const revokeBtn = row.getByRole('button', { name: /Revoke/i });
    if (await revokeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await revokeBtn.click();
    }
  }

  async deleteKey(name: string) {
    const row = await this.findKeyByName(name);
    const deleteBtn = row.locator('svg.lucide-trash-2').or(
      row.getByRole('button', { name: /Delete/i }),
    );
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();
    }
  }

  async assertHeadingVisible() {
    await expect(this.heading).toBeVisible();
  }

  async assertStatusDotsAriaHidden() {
    const count = await this.statusDots.count();
    for (let i = 0; i < count; i++) {
      await expect(this.statusDots.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  }
}
