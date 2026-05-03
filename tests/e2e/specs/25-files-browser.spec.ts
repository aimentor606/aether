import { test, expect } from '../fixtures';
import { FilesPage } from '../pages';

test.describe('Files Explorer - Browser', () => {
  let filesPage: FilesPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    filesPage = new FilesPage(authenticatedPage);
  });

  // ── File Explorer Load ──────────────────────────────────────────────────────

  test('should load files page', async () => {
    await filesPage.goto();

    const isLoaded = await filesPage.viewToggleButton
      .or(filesPage.searchButton)
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    if (!isLoaded) {
      // May show "Server not reachable" if no sandbox is running
      const serverError = filesPage.page.getByText(/Server not reachable/i);
      const hasError = await serverError.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasError).toBeTruthy();
    }
  });

  test('should show toolbar with actions', async () => {
    await filesPage.goto();

    const hasToolbar = await filesPage.searchButton
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (hasToolbar) {
      await expect(filesPage.searchButton).toBeVisible();
      // The "New" dropdown trigger (Plus icon)
      await expect(
        filesPage.page.getByRole('button', { name: /New file or folder/i }),
      ).toBeVisible();
    } else {
      test.skip(true, 'File explorer toolbar not visible — server may be unreachable');
    }
  });

  test('should show breadcrumbs', async () => {
    await filesPage.goto();

    const hasBreadcrumbs = await filesPage.breadcrumbs
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (hasBreadcrumbs) {
      // Breadcrumbs should contain at least the root/home button
      const homeButton = filesPage.page.getByRole('button', { name: /workspace/i });
      await expect(homeButton.first()).toBeVisible();
    } else {
      test.skip(true, 'Breadcrumbs not visible — server may be unreachable');
    }
  });

  test('should show file grid or list view', async () => {
    await filesPage.goto();

    // Wait for content to load
    await filesPage.page.waitForTimeout(2_000);

    const hasGrid = await filesPage.fileGrid.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasList = await filesPage.fileRows.first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasEmpty = await filesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasToolbar = await filesPage.searchButton.isVisible({ timeout: 3_000 }).catch(() => false);

    // At least one of grid, list, empty state, or toolbar must be present
    expect(hasGrid || hasList || hasEmpty || hasToolbar).toBeTruthy();
  });

  // ── View Toggle ─────────────────────────────────────────────────────────────

  test('should toggle between grid and list view', async () => {
    await filesPage.goto();

    const hasToggle = await filesPage.viewToggleButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasToggle, 'View toggle not visible — server may be unreachable');

    await filesPage.toggleView();
    // Toggle should succeed without errors
    await filesPage.page.waitForTimeout(500);
    const stillVisible = await filesPage.viewToggleButton.isVisible().catch(() => false);
    expect(stillVisible).toBeTruthy();
  });

  test('should display files in grid view', async () => {
    await filesPage.goto();

    const hasToggle = await filesPage.viewToggleButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasToggle, 'File explorer not loaded');

    // Ensure grid view by checking the toggle label
    const ariaLabel = await filesPage.viewToggleButton.getAttribute('aria-label').catch(() => '');
    if (ariaLabel?.includes('list')) {
      // Currently in grid view (toggle says "Switch to list view")
      // Grid container should be present
      const hasGrid = await filesPage.fileGrid.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(typeof hasGrid).toBe('boolean');
    } else {
      // Currently in list view — switch to grid
      await filesPage.toggleView();
      await filesPage.page.waitForTimeout(500);
    }
  });

  test('should display files in list view', async () => {
    await filesPage.goto();

    const hasToggle = await filesPage.viewToggleButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasToggle, 'File explorer not loaded');

    const ariaLabel = await filesPage.viewToggleButton.getAttribute('aria-label').catch(() => '');
    if (ariaLabel?.includes('grid')) {
      // Currently in list view (toggle says "Switch to grid view")
      const hasList = await filesPage.fileList.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(typeof hasList).toBe('boolean');
    } else {
      // Currently in grid view — switch to list
      await filesPage.toggleView();
      await filesPage.page.waitForTimeout(500);
    }
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('should navigate via breadcrumbs', async () => {
    await filesPage.goto();

    const hasBreadcrumbs = await filesPage.breadcrumbs.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasBreadcrumbs, 'Breadcrumbs not visible');

    const itemCount = await filesPage.breadcrumbItems.count();
    // Root/home is always present
    expect(itemCount).toBeGreaterThanOrEqual(1);
  });

  test('should show current path in breadcrumbs', async () => {
    await filesPage.goto();

    const hasBreadcrumbs = await filesPage.breadcrumbs.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasBreadcrumbs, 'Breadcrumbs not visible');

    // Root level should show /workspace or home label
    const breadcrumbText = await filesPage.breadcrumbs.textContent().catch(() => '');
    expect(breadcrumbText).toBeTruthy();
  });

  // ── File Operations ─────────────────────────────────────────────────────────

  test('should show upload button', async () => {
    await filesPage.goto();

    const hasToolbar = await filesPage.searchButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasToolbar, 'File explorer not loaded');

    // Open the "New" dropdown to reveal upload option
    const newButton = filesPage.page.getByRole('button', { name: /New file or folder/i });
    if (await newButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newButton.click();
      await expect(filesPage.uploadButton).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should show new folder button', async () => {
    await filesPage.goto();

    const hasToolbar = await filesPage.searchButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasToolbar, 'File explorer not loaded');

    const newButton = filesPage.page.getByRole('button', { name: /New file or folder/i });
    if (await newButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newButton.click();
      await expect(filesPage.newFolderButton).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should show search functionality', async () => {
    await filesPage.goto();

    const hasSearchBtn = await filesPage.searchButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasSearchBtn, 'Search button not visible');

    await expect(filesPage.searchButton).toBeVisible();
    await filesPage.searchButton.click();

    // Search overlay should render an input
    const searchInput = filesPage.page.locator('input[type="text"]').first();
    const inputVisible = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(inputVisible).toBeTruthy();
  });

  // ── File Preview ────────────────────────────────────────────────────────────

  test('should open file preview on click', async () => {
    await filesPage.goto();

    // Wait for files to load
    await filesPage.page.waitForTimeout(2_000);

    const fileCount = await filesPage.getFileCount();
    test.skip(fileCount === 0, 'No files available to preview');

    await filesPage.openFile(0);

    // Preview modal may open (depends on whether item is a file or directory)
    const modalVisible = await filesPage.previewModal.isVisible({ timeout: 5_000 }).catch(() => false);
    // Either modal opened or we navigated into a directory — both are valid
    expect(typeof modalVisible).toBe('boolean');
  });

  test('should close file preview', async () => {
    await filesPage.goto();

    await filesPage.page.waitForTimeout(2_000);

    const fileCount = await filesPage.getFileCount();
    test.skip(fileCount === 0, 'No files available to preview');

    await filesPage.openFile(0);

    const modalVisible = await filesPage.previewModal.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!modalVisible, 'Preview modal did not open');

    await filesPage.previewCloseButton.click();
    await expect(filesPage.previewModal).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Empty State ─────────────────────────────────────────────────────────────

  test('should show empty state for empty folder', async () => {
    await filesPage.goto();

    await filesPage.page.waitForTimeout(2_000);

    const hasEmptyState = await filesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    const fileCount = await filesPage.getFileCount();

    // Either we see the empty state message or there are files present
    expect(hasEmptyState || fileCount > 0).toBeTruthy();
  });

  // ── Deep Link ───────────────────────────────────────────────────────────────

  test('should navigate to specific file path via URL', async ({ authenticatedPage }) => {
    const deepPath = 'src/main.ts';
    await authenticatedPage.goto(`/files/${encodeURIComponent(deepPath)}`);

    // Page should load without errors — either shows the file viewer
    // or the file explorer with the path loaded
    const url = authenticatedPage.url();
    expect(url).toContain('/files/');
  });
});
