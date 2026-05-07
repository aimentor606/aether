// Get current date in local timezone
export function getLocalToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Format a date as YYYY-MM-DD in local timezone (avoids toISOString UTC conversion)
export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper to determine monthIndex from date: Dec 2025 = 0, Jan 2026 = 1, etc.
export function getMonthIndex(date: Date): number {
  return date.getFullYear() === 2025 && date.getMonth() === 11
    ? 0
    : date.getMonth() + 1;
}

// Calculate current week number and month index for filtering chart data (local timezone)
export function getCurrentPeriod(): {
  currentWeekNumber: number;
  currentMonthIndex: number;
} {
  const startDate = new Date(2025, 11, 15); // Dec 15, 2025
  const today = getLocalToday();
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNum = Math.max(1, Math.floor(daysSinceStart / 7) + 1);

  // Month index: Dec 2025 = 0, Jan 2026 = 1, Feb 2026 = 2, etc.
  const monthIdx =
    today.getFullYear() === 2025 && today.getMonth() === 11
      ? 0
      : today.getFullYear() === 2026
        ? today.getMonth() + 1
        : 0;

  return { currentWeekNumber: weekNum, currentMonthIndex: monthIdx };
}

// Get week number from a date string (based on Dec 15, 2025 start)
export function getWeekNumber(dateStr: string): number {
  const startDate = new Date(2025, 11, 15); // Dec 15, 2025
  const date = new Date(dateStr);
  const daysSinceStart = Math.floor(
    (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.floor(daysSinceStart / 7) + 1;
}
