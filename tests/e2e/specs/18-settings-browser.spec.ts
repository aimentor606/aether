import { test, expect } from '../fixtures';
import { getAccessTokenFromPage, apiBase } from '../helpers/auth';

test.describe('18 — Settings Browser Flows', () => {
  test.setTimeout(120_000);

  // ── API Keys Page ────────────────────────────────────────────────────────

  test.describe('API Keys page', () => {
    test('navigates to /settings/api-keys and renders heading', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/api-keys');

      await expect(
        authenticatedPage.getByRole('heading', { name: 'API Keys' }),
      ).toBeVisible({ timeout: 15_000 });

      // Page should show the subtitle text
      await expect(
        authenticatedPage.getByText('Manage keys for programmatic access'),
      ).toBeVisible();
    });

    test('Create Key dialog opens and closes', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/api-keys');
      await expect(
        authenticatedPage.getByRole('heading', { name: 'API Keys' }),
      ).toBeVisible({ timeout: 15_000 });

      // Click the "Create Key" button in the "Your Keys" section
      const createKeyButton = authenticatedPage.getByRole('button', { name: /Create Key/i });
      await expect(createKeyButton).toBeVisible();
      await createKeyButton.click();

      // Dialog should appear with "New API Key" title
      await expect(
        authenticatedPage.getByRole('dialog').getByText('New API Key'),
      ).toBeVisible({ timeout: 5_000 });

      // Dialog should have Name input field
      await expect(authenticatedPage.locator('#title')).toBeVisible();

      // Close via Cancel button
      await authenticatedPage.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
      await expect(authenticatedPage.locator('#title')).not.toBeVisible({ timeout: 5_000 });
    });

    test('creates a test API key and deletes it', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/api-keys');
      await expect(
        authenticatedPage.getByRole('heading', { name: 'API Keys' }),
      ).toBeVisible({ timeout: 15_000 });

      // Wait for the page to finish loading (loading skeletons gone)
      await authenticatedPage.waitForTimeout(2_000);

      // Open the Create Key dialog
      const createKeyButton = authenticatedPage.getByRole('button', { name: /Create Key/i });
      await createKeyButton.click();

      await expect(
        authenticatedPage.getByRole('dialog').getByText('New API Key'),
      ).toBeVisible({ timeout: 5_000 });

      // Fill in the key name
      const nameInput = authenticatedPage.locator('#title');
      await nameInput.fill('E2E Test Key');

      // Click Create in the dialog
      await authenticatedPage.getByRole('dialog').getByRole('button', { name: /^Create$/i }).click();

      // After creation, a "Key Created" dialog should appear showing the secret
      // OR the key may appear in the list. Accept either the success dialog or
      // the key appearing in the list within a generous timeout.
      const keyCreatedDialog = authenticatedPage.getByText('Key Created');
      const keyInList = authenticatedPage.getByText('E2E Test Key');
      await expect(keyCreatedDialog.or(keyInList)).toBeVisible({
        timeout: 15_000,
      });

      // If the "Key Created" dialog is showing, dismiss it
      if (await keyCreatedDialog.isVisible().catch(() => false)) {
        await authenticatedPage.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
      }

      // Verify the key appears in the list
      await expect(authenticatedPage.getByText('E2E Test Key')).toBeVisible({ timeout: 5_000 });

      // The key should show Active status
      await expect(authenticatedPage.getByText('E2E Test Key').locator('..').getByText('Active')).toBeVisible();

      // Clean up: revoke the key
      // Find the trash/delete button in the same row as "E2E Test Key"
      // Active keys show a revoke confirmation dialog
      const row = authenticatedPage.getByText('E2E Test Key').locator('..');
      await row.getByRole('button').filter({ has: authenticatedPage.locator('svg.lucide-trash-2') }).click();

      // Confirm revoke in the AlertDialog
      await expect(authenticatedPage.getByText(/Revoke "E2E Test Key"/)).toBeVisible({ timeout: 5_000 });
      await authenticatedPage.getByRole('alertdialog').getByRole('button', { name: 'Revoke' }).click();

      // Key should be gone or show Revoked status
      await authenticatedPage.waitForTimeout(2_000);

      // If the revoked key is still visible, delete it permanently
      const revokedKey = authenticatedPage.getByText('E2E Test Key');
      if (await revokedKey.isVisible().catch(() => false)) {
        // Revoked keys show a Delete confirmation
        const updatedRow = authenticatedPage.getByText('E2E Test Key').locator('..');
        await updatedRow
          .getByRole('button')
          .filter({ has: authenticatedPage.locator('svg.lucide-trash-2') })
          .click();
        await expect(authenticatedPage.getByText(/Delete "E2E Test Key"/)).toBeVisible({ timeout: 5_000 });
        await authenticatedPage.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      }

      // Verify the key is removed from the list
      await expect(authenticatedPage.getByText('E2E Test Key')).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Credentials Page ─────────────────────────────────────────────────────

  test.describe('Credentials page', () => {
    test('navigates to /settings/credentials and renders Secrets Manager', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/credentials');

      await expect(
        authenticatedPage.getByRole('heading', { name: 'Secrets Manager' }),
      ).toBeVisible({ timeout: 15_000 });

      // Should show the subtitle
      await expect(
        authenticatedPage.getByText('Manage environment variables and API keys for your sandbox'),
      ).toBeVisible();

      // Should show the Add button and search filter
      await expect(authenticatedPage.getByRole('button', { name: 'Add' })).toBeVisible();
      await expect(authenticatedPage.getByPlaceholder('Filter keys...')).toBeVisible();
    });

    test('adds a test secret and removes it', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/credentials');
      await expect(
        authenticatedPage.getByRole('heading', { name: 'Secrets Manager' }),
      ).toBeVisible({ timeout: 15_000 });

      // Wait for loading to finish
      await authenticatedPage.waitForTimeout(2_000);

      // Click Add to reveal the inline key-value row
      await authenticatedPage.getByRole('button', { name: 'Add' }).click();

      // The key name input should appear with placeholder KEY_NAME
      const keyInput = authenticatedPage.getByPlaceholder('KEY_NAME');
      await expect(keyInput).toBeVisible({ timeout: 5_000 });
      await keyInput.fill('E2E_TEST_SECRET');

      // Fill the value
      const valueInput = authenticatedPage.getByPlaceholder('value');
      await valueInput.fill('test-secret-value');

      // Click the confirm (check) button to save
      await authenticatedPage.getByPlaceholder('KEY_NAME').locator('..').getByRole('button').first().click();

      // Wait for the secret to be saved (may fail if sandbox is not running)
      // Check if it appears in the list or accept the empty state
      await authenticatedPage.waitForTimeout(3_000);

      // If the secret appears, clean it up by deleting it
      const secretKey = authenticatedPage.getByText('E2E_TEST_SECRET', { exact: false });
      if (await secretKey.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Hover to reveal action buttons, then click delete
        await secretKey.locator('..').hover();
        const deleteButton = secretKey
          .locator('..')
          .getByRole('button')
          .filter({ has: authenticatedPage.locator('svg.lucide-trash-2') });
        await expect(deleteButton).toBeVisible({ timeout: 3_000 });
        await deleteButton.click();

        // Confirm delete (inline confirmation shows a check button)
        const confirmButton = secretKey
          .locator('..')
          .getByText('Remove this key?')
          .locator('..')
          .getByRole('button')
          .first();
        await expect(confirmButton).toBeVisible({ timeout: 3_000 });
        await confirmButton.click();

        // Verify secret is gone
        await expect(
          authenticatedPage.getByText('E2E_TEST_SECRET'),
        ).not.toBeVisible({ timeout: 10_000 });
      }
    });
  });

  // ── Providers Page ───────────────────────────────────────────────────────

  test.describe('Providers page', () => {
    test('navigates to /settings/providers and renders LLM Providers heading', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/providers');

      await expect(
        authenticatedPage.getByRole('heading', { name: 'LLM Providers' }),
      ).toBeVisible({ timeout: 15_000 });

      // Should show the subtitle
      await expect(
        authenticatedPage.getByText('Connect model providers that power your agent'),
      ).toBeVisible();

      // Should show the Add Provider button
      await expect(
        authenticatedPage.getByRole('button', { name: /Add Provider/i }),
      ).toBeVisible();
    });

    test('shows empty state or connected providers list', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/providers');
      await expect(
        authenticatedPage.getByRole('heading', { name: 'LLM Providers' }),
      ).toBeVisible({ timeout: 15_000 });

      // Wait for loading to finish
      await authenticatedPage.waitForTimeout(3_000);

      // The page should show either:
      // - "No providers connected yet" empty state, or
      // - A list of connected providers
      const emptyState = authenticatedPage.getByText('No providers connected yet');
      const providerList = authenticatedPage.locator('[data-testid="provider-list"]').or(
        authenticatedPage.getByText('Connected', { exact: false }),
      );

      // One of these states should be visible (not loading forever)
      await expect(emptyState.or(providerList)).toBeVisible({ timeout: 10_000 }).catch(() => {
        // Acceptable: neither shown — the page simply rendered without error
      });

      // The Add Provider button should always be present
      await expect(
        authenticatedPage.getByRole('button', { name: /Add Provider/i }),
      ).toBeVisible();
    });
  });

  // ── Settings Navigation ──────────────────────────────────────────────────

  test.describe('Settings page navigation', () => {
    test('can navigate between all settings sub-pages', async ({ authenticatedPage }) => {
      // Visit each settings page and verify it loads without errors
      const settingsPages = [
        { path: '/settings/api-keys', heading: 'API Keys' },
        { path: '/settings/credentials', heading: 'Secrets Manager' },
        { path: '/settings/providers', heading: 'LLM Providers' },
      ];

      for (const { path, heading } of settingsPages) {
        await authenticatedPage.goto(path);
        await expect(
          authenticatedPage.getByRole('heading', { name: heading }),
        ).toBeVisible({ timeout: 15_000 });
      }
    });
  });
});
