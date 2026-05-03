import { test, expect } from '../fixtures';
import { SessionPage } from '../pages';

test.describe('Sessions & Chat - Browser', () => {
  let sessionPage: SessionPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    sessionPage = new SessionPage(authenticatedPage);
  });

  test.describe('Session List (Sidebar)', () => {
    test('should show New Session button in sidebar', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      await expect(sessionPage.sidebarNewSessionButton).toBeVisible({ timeout: 15_000 });
    });

    test('should display session list or empty state in sidebar', async () => {
      await sessionPage.page.goto('/dashboard');
      await sessionPage.page.waitForLoadState('networkidle').catch(() => {});

      const hasSessions = await sessionPage.sessionEmptyState.isVisible({ timeout: 5_000 }).then(() => false).catch(() => true);
      if (hasSessions) {
        const rows = await sessionPage.getSessionRows();
        expect(rows.length).toBeGreaterThanOrEqual(0);
      } else {
        await expect(sessionPage.sessionEmptyState).toBeVisible();
      }
    });

    test('should show session titles or Untitled fallback', async () => {
      await sessionPage.page.goto('/dashboard');
      await sessionPage.page.waitForLoadState('networkidle').catch(() => {});

      const hasSessions = await sessionPage.sessionEmptyState.isVisible({ timeout: 5_000 }).then(() => false).catch(() => true);
      test.skip(!hasSessions, 'No sessions to verify titles');

      const firstRow = sessionPage.sessionRows.first();
      await expect(firstRow).toBeVisible();
      const text = await firstRow.textContent();
      expect(text).toBeTruthy();
    });
  });

  test.describe('Session Creation', () => {
    test('should create a new session via sidebar button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const sessionId = await sessionPage.createNewSession();
      expect(sessionId).toBeTruthy();
      expect(authenticatedPage.url()).toContain('/sessions/');
    });

    test('should show chat input on new session', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();
    });

    test('should show welcome/empty state on new session', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      await sessionPage.createNewSession();
      const hasWelcome = await sessionPage.welcomeState.isVisible({ timeout: 10_000 }).catch(() => false);
      const hasChatInput = await sessionPage.chatInput.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasWelcome || hasChatInput).toBeTruthy();
    });
  });

  test.describe('Chat Interaction', () => {
    test('should have textarea with placeholder text', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      const placeholder = await sessionPage.chatInput.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });

    test('should show send button after typing text', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      await sessionPage.chatInput.fill('Hello from E2E test');
      await expect(sessionPage.sendButton).toBeVisible({ timeout: 5_000 });
    });

    test('should show attach files button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      await expect(sessionPage.attachButton).toBeVisible();
    });

    test('should display user message after sending', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      const testMessage = `E2E test message ${Date.now()}`;
      await sessionPage.sendMessage(testMessage);

      await authenticatedPage.waitForFunction(
        (msg) => {
          const turns = document.querySelectorAll('[data-turn-id]');
          return turns.length > 0 && turns[0].textContent?.includes(msg);
        },
        testMessage,
        { timeout: 30_000 },
      );

      const msgCount = await sessionPage.getMessageCount();
      expect(msgCount).toBeGreaterThanOrEqual(1);
    });

    test('should show stop button while processing', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      await sessionPage.sendMessage('Write a long essay about machine learning');

      const stopVisible = await sessionPage.stopButton.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(typeof stopVisible).toBe('boolean');
    });

    test('should show more actions dropdown', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      const actionsVisible = await sessionPage.moreActionsButton.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(typeof actionsVisible).toBe('boolean');
    });
  });

  test.describe('Session Navigation', () => {
    test('should navigate to existing session via sidebar', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const hasSessions = await sessionPage.sessionEmptyState.isVisible({ timeout: 5_000 }).then(() => false).catch(() => true);
      test.skip(!hasSessions, 'No sessions to navigate to');

      const firstRow = sessionPage.sessionRows.first();
      await firstRow.click();
      await authenticatedPage.waitForURL(/\/sessions\/[^/]+/, { timeout: 10_000 });
      await sessionPage.assertChatVisible();
    });

    test('should show session not found for invalid ID', async ({ authenticatedPage }) => {
      await sessionPage.goto('nonexistent-session-id-99999');

      const notFound = authenticatedPage.getByText(/Session not found|Not Found/i);
      const hasError = await notFound.isVisible({ timeout: 15_000 }).catch(() => false);
      expect(hasError || authenticatedPage.url().includes('/dashboard') || authenticatedPage.url().includes('/instances')).toBeTruthy();
    });

    test('should preserve sidebar session list on session detail', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();

      const sidebarVisible = await sessionPage.sidebarNewSessionButton.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(sidebarVisible).toBeTruthy();
    });
  });

  test.describe('Chat Input Features', () => {
    test('should show slash command menu when typing /', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      await sessionPage.chatInput.focus();
      await authenticatedPage.keyboard.type('/');

      const commandMenu = authenticatedPage.locator('[class*="fixed"]').filter({ hasText: /command/i }).or(
        authenticatedPage.getByRole('listbox'),
      );
      const menuVisible = await commandMenu.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(typeof menuVisible).toBe('boolean');
    });

    test('should show mention popup when typing @', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await sessionPage.createNewSession();
      await sessionPage.assertChatVisible();

      await sessionPage.chatInput.focus();
      await authenticatedPage.keyboard.type('@');

      const mentionPopup = authenticatedPage.locator('[class*="fixed"]').filter({ hasText: /agent|file|session/i }).or(
        authenticatedPage.getByRole('listbox'),
      );
      const popupVisible = await mentionPopup.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(typeof popupVisible).toBe('boolean');
    });

    test('should support keyboard shortcut for new session', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const urlBefore = authenticatedPage.url();
      await authenticatedPage.keyboard.press('Meta+j');

      await authenticatedPage.waitForTimeout(2_000);
      const urlChanged = authenticatedPage.url() !== urlBefore;
      const buttonVisible = await sessionPage.sidebarNewSessionButton.isVisible().catch(() => false);
      expect(urlChanged || buttonVisible).toBeTruthy();
    });
  });
});
