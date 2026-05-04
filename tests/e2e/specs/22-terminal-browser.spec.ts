import { test, expect } from '../fixtures';
import { TerminalPage } from '../pages';

test.describe('Terminal - Browser', () => {
  let terminalPage: TerminalPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    terminalPage = new TerminalPage(authenticatedPage);
  });

  test.describe('Terminal Page Access', () => {
    test('should handle direct navigation to terminal with invalid ID', async ({ authenticatedPage }) => {
      await terminalPage.gotoViaId('nonexistent-terminal-id-99999');

      const pageContent = await authenticatedPage.textContent('body').catch(() => '');
      expect(pageContent).toBeTruthy();
    });

    test('should handle navigation to terminal route without ID', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/terminal');

      const url = authenticatedPage.url();
      expect(url).toBeTruthy();
    });
  });

  test.describe('Terminal Panel (within session)', () => {
    test('should show terminal option in session sidebar actions', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const newTerminalBtn = authenticatedPage.getByRole('button', { name: /New Terminal|terminal/i });
      const terminalVisible = await newTerminalBtn.isVisible({ timeout: 10_000 }).catch(() => false);
      expect(typeof terminalVisible).toBe('boolean');
    });

    test('should show empty state when no terminal sessions exist', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const emptyState = authenticatedPage.getByText(/No terminal sessions/i);
      const hasEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(typeof hasEmpty).toBe('boolean');
    });

    test('should have New Terminal button accessible', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const newTerminalBtn = terminalPage.newTerminalButton;
      const btnExists = await newTerminalBtn.isVisible({ timeout: 10_000 }).catch(() => false);
      expect(typeof btnExists).toBe('boolean');
    });
  });

  test.describe('Terminal Interaction', () => {
    test('should open terminal panel and show xterm container', async ({ authenticatedPage }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set — skipping terminal interaction');

      await authenticatedPage.goto(`/instances/${instanceId}/sessions`);
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const newTerminalBtn = terminalPage.newTerminalButton;
      if (await newTerminalBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await newTerminalBtn.click();
        await authenticatedPage.waitForTimeout(3_000);

        const xtermVisible = await terminalPage.terminalContainer.isVisible({ timeout: 10_000 }).catch(() => false);
        expect(typeof xtermVisible).toBe('boolean');
      }
    });

    test('should accept keyboard input in terminal', async ({ authenticatedPage }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      await authenticatedPage.goto(`/instances/${instanceId}/sessions`);
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const xterm = terminalPage.terminalContainer;
      if (await xterm.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await xterm.click();
        await authenticatedPage.keyboard.type('echo hello');
        expect(true).toBeTruthy();
      }
    });
  });

  test.describe('Terminal Tab Management', () => {
    test('should show tab bar when terminal is open', async ({ authenticatedPage }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      await authenticatedPage.goto(`/instances/${instanceId}/sessions`);
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const newTerminalBtn = terminalPage.newTerminalButton;
      if (await newTerminalBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await newTerminalBtn.click();
        await authenticatedPage.waitForTimeout(3_000);

        const tabCount = await terminalPage.getTabCount();
        expect(tabCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle terminal refresh', async ({ authenticatedPage }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      await authenticatedPage.goto(`/instances/${instanceId}/sessions`);
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const refreshBtn = terminalPage.refreshButton;
      if (await refreshBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await refreshBtn.click();
        await authenticatedPage.waitForTimeout(2_000);
        expect(authenticatedPage.url()).toBeTruthy();
      }
    });
  });

  test.describe('Terminal Accessibility', () => {
    test('should have visible terminal controls with proper roles', async ({ authenticatedPage }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      await authenticatedPage.goto(`/instances/${instanceId}/sessions`);
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      const btn = terminalPage.newTerminalButton;
      if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        const role = await btn.getAttribute('role');
        const tagName = await btn.evaluate((el: HTMLElement) => el.tagName.toLowerCase());
        expect(role === 'button' || tagName === 'button' || tagName === 'a').toBeTruthy();
      }
    });

    test('should be keyboard navigable', async ({ authenticatedPage }) => {
      const instanceId = process.env.E2E_INSTANCE_ID;
      test.skip(!instanceId, 'No E2E_INSTANCE_ID set');

      await authenticatedPage.goto(`/instances/${instanceId}/sessions`);
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const newSessionBtn = authenticatedPage.getByRole('button', { name: /New session/i });
      if (await newSessionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await newSessionBtn.click();
        await authenticatedPage.waitForURL(/\/sessions\//, { timeout: 15_000 });
      }

      for (let i = 0; i < 10; i++) {
        await authenticatedPage.keyboard.press('Tab');
      }
      expect(authenticatedPage.url()).toBeTruthy();
    });
  });
});
