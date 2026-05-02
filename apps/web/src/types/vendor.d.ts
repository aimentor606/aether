declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export function gfm(service: TurndownService): void;
  export function tables(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
}

declare module 'file-saver' {
  export function saveAs(data: Blob | string, filename?: string, options?: any): void;
}

declare module 'sql.js' {
  export interface SqlValueMap {
    [key: string]: unknown;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export class Database {
    constructor(data?: Uint8Array);
    exec(sql: string): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
}

declare module 'exceljs' {
  export interface Cell {
    value: unknown;
    style?: Record<string, unknown>;
  }

  export interface Row {
    eachCell(options: { includeEmpty: boolean }, callback: (cell: Cell, colNumber: number) => void): void;
  }

  export interface WorksheetColumn {
    width?: number;
  }

  export interface Worksheet {
    name: string;
    columns?: WorksheetColumn[];
    properties?: Record<string, unknown>;
    eachRow(options: { includeEmpty: boolean }, callback: (row: Row, rowNumber: number) => void): void;
  }

  export class Workbook {
    xlsx: {
      load(data: ArrayBuffer): Promise<void>;
    };
    eachSheet(callback: (worksheet: Worksheet) => void): void;
  }
}

declare module 'xlsx' {
  export interface WorkSheet {
    ['!merges']?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
    [key: string]: unknown;
  }

  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  export function read(data: ArrayBuffer, opts: Record<string, unknown>): WorkBook;

  export const utils: {
    sheet_to_json(sheet: WorkSheet, opts: Record<string, unknown>): unknown[][];
  };
}

declare module '@univerjs/presets' {
  export const LocaleType: { EN_US: string };
  export function mergeLocales(...locales: unknown[]): unknown;
  export function createUniver(config: Record<string, unknown>): {
    univerAPI: {
      dispose(): void;
      createWorkbook(workbook: unknown): void;
      addEvent(event: unknown, handler: (payload: { stage: unknown }) => void): void;
      Event: { LifeCycleChanged: unknown };
      Enum: { LifecycleStages: { Rendered: unknown } };
      getActiveWorkbook(): {
        getId(): string;
        getPermission(): {
          setWorkbookEditPermission(unitId: string, allowed: boolean): void;
          setPermissionDialogVisible(visible: boolean): void;
        };
      } | null;
    };
  };
}

declare module '@univerjs/preset-sheets-core' {
  export function UniverSheetsCorePreset(config: Record<string, unknown>): unknown;
}

declare module '@univerjs/preset-sheets-core/locales/en-US' {
  const value: unknown;
  export default value;
}
