import { type Locator, type Page } from '@playwright/test';

/**
 * Page Object Model for the Files Explorer page (/files).
 *
 * The file explorer uses a Google Drive-style layout with:
 * - DriveToolbar: breadcrumbs + view toggle + sort + search + new/upload actions
 * - Main area: grid view (file cards with thumbnails) or list view (table rows)
 * - FilePreviewModal: full-screen overlay with blurred backdrop
 * - FileSearch: search overlay toggled via toolbar button
 *
 * Source: apps/web/src/features/files/components/file-explorer-page.tsx
 */
export class FilesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly toolbar: Locator;
  readonly uploadButton: Locator;
  readonly newFolderButton: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly viewToggleButton: Locator;
  readonly breadcrumbs: Locator;
  readonly breadcrumbItems: Locator;
  readonly fileGrid: Locator;
  readonly fileList: Locator;
  readonly fileCards: Locator;
  readonly fileRows: Locator;
  readonly fileTree: Locator;
  readonly previewModal: Locator;
  readonly previewCloseButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page-level heading — the file explorer does not have a traditional h1;
    // the toolbar area serves as the primary visual landmark.
    this.heading = page.locator('h1, h2, h3').first();

    // Drive toolbar container
    this.toolbar = page.getByTestId('files-toolbar');

    // Upload button — opens file picker (in the "New" dropdown menu)
    this.uploadButton = page.getByTestId('upload-button');

    // New folder button — in the "New" dropdown menu
    this.newFolderButton = page.getByTestId('new-folder-button');

    // Search toggle button in toolbar
    this.searchButton = page.getByTestId('files-search');

    // Search input — appears in FileSearch overlay after toggling
    this.searchInput = page.getByPlaceholder(/Search files|Search/i);

    // View toggle (grid/list switch)
    this.viewToggleButton = page.getByTestId('view-toggle');

    // Breadcrumb navigation (nav element inside toolbar)
    this.breadcrumbs = page.getByTestId('files-breadcrumbs');

    // Individual breadcrumb segment buttons
    this.breadcrumbItems = this.breadcrumbs.locator('button');

    // Grid view container (DriveGridView renders file cards in a CSS grid)
    this.fileGrid = page.locator('div[class*="grid"]');

    // List view container (DriveListView renders table rows)
    this.fileList = page.locator('table, [role="table"]').or(
      page.locator('div.flex-1.overflow-y-auto'),
    );

    // File cards in grid view
    this.fileCards = page.getByTestId('file-card');

    // File rows in list view
    this.fileRows = page.getByTestId('file-row');

    // File tree sidebar
    this.fileTree = page.getByTestId('file-tree');

    // Preview modal — full-screen overlay
    this.previewModal = page.getByTestId('file-preview');

    // Preview close button (X icon in top bar)
    this.previewCloseButton = page.getByRole('button', { name: /Close preview/i });

    // Empty state message
    this.emptyState = page.getByTestId('files-empty');
  }

  /**
   * Navigate to the files page, optionally with a deep-linked path.
   */
  async goto(path?: string) {
    const url = path ? `/files/${path}` : '/files';
    await this.page.goto(url);
  }

  /**
   * Verify the file explorer has loaded by checking the toolbar is visible.
   */
  async assertLoaded() {
    await this.viewToggleButton
      .or(this.breadcrumbs)
      .or(this.searchButton)
      .waitFor({ timeout: 15_000 });
  }

  /**
   * Click the grid/list view toggle button.
   */
  async toggleView() {
    await this.viewToggleButton.click();
  }

  /**
   * Open the search overlay and type a query.
   */
  async searchFiles(query: string) {
    await this.searchButton.click();
    // FileSearch renders an input after toggle
    const searchInput = this.page.locator('input[type="text"]').first();
    await searchInput.waitFor({ timeout: 5_000 }).catch(() => {});
    await searchInput.fill(query);
  }

  /**
   * Click a breadcrumb segment by index (0 = root/home).
   */
  async navigateBreadcrumb(index: number) {
    const items = this.breadcrumbItems;
    const count = await items.count();
    if (index >= count) {
      throw new Error(`Breadcrumb index ${index} out of range (count: ${count})`);
    }
    await items.nth(index).click();
  }

  /**
   * Return the number of visible file items in the current view (grid or list).
   */
  async getFileCount(): Promise<number> {
    // Try grid cards first, then list rows
    const cardCount = await this.fileCards.count();
    if (cardCount > 0) return cardCount;

    const rowCount = await this.fileRows.count();
    return rowCount;
  }

  /**
   * Click a file item by index to open or preview it.
   */
  async openFile(index: number) {
    const cardCount = await this.fileCards.count();
    if (cardCount > 0) {
      await this.fileCards.nth(index).click();
      return;
    }
    const rowCount = await this.fileRows.count();
    if (rowCount > 0) {
      await this.fileRows.nth(index).click();
      return;
    }
    throw new Error(`No file items found to open at index ${index}`);
  }
}
