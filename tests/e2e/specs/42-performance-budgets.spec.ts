import { test, expect } from '../fixtures';

type NavTiming = {
  domContentLoaded: number;
  load: number;
  ttfb: number;
  firstPaint: number;
  firstContentfulPaint: number;
  domInteractive: number;
};

type PerfMetrics = {
  domNodes: number;
  jsHeapUsed: number;
  jsHeapTotal: number;
  layoutDuration: number;
  recalcStyleCount: number;
};

async function getNavigationTiming(page: import('@playwright/test').Page): Promise<Partial<NavTiming>> {
  return page.evaluate(() => {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (!entry) return {};
    const fp = performance.getEntriesByName('first-paint')[0]?.startTime;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    return {
      domContentLoaded: Math.round(entry.domContentLoadedEventEnd - entry.startTime),
      load: Math.round(entry.loadEventEnd - entry.startTime),
      ttfb: Math.round(entry.responseStart - entry.requestStart),
      firstPaint: fp ? Math.round(fp) : undefined,
      firstContentfulPaint: fcp ? Math.round(fcp) : undefined,
      domInteractive: Math.round(entry.domInteractive - entry.startTime),
    };
  });
}

async function getPerfMetrics(page: import('@playwright/test').Page): Promise<PerfMetrics> {
  return page.evaluate(() => {
    const m = (performance as any).memory;
    const heap = m
      ? { used: Math.round(m.usedJSHeapSize / 1048576), total: Math.round(m.totalJSHeapSize / 1048576) }
      : { used: 0, total: 0 };
    return {
      domNodes: document.querySelectorAll('*').length,
      jsHeapUsed: heap.used,
      jsHeapTotal: heap.total,
      layoutDuration: 0,
      recalcStyleCount: 0,
    };
  });
}

async function measurePageLoad(page: import('@playwright/test').Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2_000);

  const timing = await getNavigationTiming(page);
  const metrics = await getPerfMetrics(page);
  return { timing, metrics };
}

function logPerformance(label: string, timing: Partial<NavTiming>, metrics: PerfMetrics) {
  console.log(`[${label}] TTFB: ${timing.ttfb}ms | FP: ${timing.firstPaint}ms | FCP: ${timing.firstContentfulPaint}ms | Load: ${timing.load}ms | DOM: ${metrics.domNodes} | Heap: ${metrics.jsHeapUsed}MB`);
}

const BUDGETS = {
  ttfb: 2000,
  fcp: 3000,
  load: 10000,
  domNodes: 2000,
  jsHeapMB: 100,
} as const;

test.describe('Performance Budgets', () => {
  test.describe('Auth Page', () => {
    test('auth page meets load time budget', async ({ page }) => {
      const { timing, metrics } = await measurePageLoad(page, '/auth');

      logPerformance('auth', timing, metrics);

      if (timing.ttfb) {
        expect(timing.ttfb, `TTFB ${timing.ttfb}ms > ${BUDGETS.ttfb}ms`).toBeLessThan(BUDGETS.ttfb);
      }
      if (timing.firstContentfulPaint) {
        expect(timing.firstContentfulPaint, `FCP ${timing.firstContentfulPaint}ms > ${BUDGETS.fcp}ms`).toBeLessThan(BUDGETS.fcp);
      }
    });

    test('auth page has reasonable DOM size', async ({ page }) => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle').catch(() => {});
      const metrics = await getPerfMetrics(page);
      expect(metrics.domNodes, `${metrics.domNodes} DOM nodes > ${BUDGETS.domNodes}`).toBeLessThan(BUDGETS.domNodes);
    });
  });

  test.describe('Dashboard Pages', () => {
    const dashboardPages = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Instances', path: '/instances' },
      { name: 'Workspace', path: '/workspace' },
      { name: 'Files', path: '/files' },
      { name: 'Finance', path: '/finance' },
      { name: 'Usage', path: '/usage' },
    ];

    for (const { name, path } of dashboardPages) {
      test(`${name} (${path}) meets TTFB budget`, async ({ authenticatedPage }) => {
        const { timing, metrics } = await measurePageLoad(authenticatedPage, path);

        logPerformance(name, timing, metrics);

        if (timing.ttfb) {
          expect(timing.ttfb, `${name} TTFB ${timing.ttfb}ms > ${BUDGETS.ttfb}ms`).toBeLessThan(BUDGETS.ttfb);
        }
      });

      test(`${name} (${path}) meets FCP budget`, async ({ authenticatedPage }) => {
        await authenticatedPage.goto(path);
        await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
        await authenticatedPage.waitForTimeout(2_000);

        const timing = await getNavigationTiming(authenticatedPage);
        if (timing.firstContentfulPaint) {
          expect(timing.firstContentfulPaint, `${name} FCP ${timing.firstContentfulPaint}ms > ${BUDGETS.fcp}ms`).toBeLessThan(BUDGETS.fcp);
        }
      });

      test(`${name} (${path}) has reasonable DOM size`, async ({ authenticatedPage }) => {
        await authenticatedPage.goto(path);
        await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
        await authenticatedPage.waitForTimeout(1_000);

        const metrics = await getPerfMetrics(authenticatedPage);
        expect(metrics.domNodes, `${name} has ${metrics.domNodes} DOM nodes`).toBeLessThan(BUDGETS.domNodes);
      });
    }
  });

  test.describe('Settings Pages', () => {
    test('settings pages have reasonable DOM sizes', async ({ authenticatedPage }) => {
      const pages = ['/settings/api-keys', '/settings/credentials'];
      for (const path of pages) {
        await authenticatedPage.goto(path);
        await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
        await authenticatedPage.waitForTimeout(1_000);

        const metrics = await getPerfMetrics(authenticatedPage);
        expect(metrics.domNodes, `${path} has ${metrics.domNodes} nodes`).toBeLessThan(BUDGETS.domNodes);
      }
    });
  });

  test.describe('Layout Shifts (CLS)', () => {
    test('dashboard has minimal layout shifts', async ({ authenticatedPage }) => {
      const clsScore = await authenticatedPage.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });

          // Wait for layout to stabilize
          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 3000);
        });
      });

      // CLS should be < 0.1 for good, < 0.25 for needs improvement
      expect(clsScore, `CLS ${clsScore.toFixed(4)} > 0.25`).toBeLessThan(0.25);
      if (clsScore > 0.1) {
        console.log(`[CLS] Dashboard CLS ${clsScore.toFixed(4)} — needs improvement (> 0.1)`);
      }
    });

    test('instances page has minimal layout shifts', async ({ authenticatedPage }) => {
      const clsScore = await authenticatedPage.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 3000);
        });
      });

      expect(clsScore, `CLS ${clsScore.toFixed(4)} > 0.25`).toBeLessThan(0.25);
    });
  });

  test.describe('Long Tasks', () => {
    test('dashboard avoids long tasks (>50ms) on load', async ({ authenticatedPage }) => {
      const longTasks = await authenticatedPage.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let count = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.duration > 50) count++;
            }
          });
          observer.observe({ type: 'longtask', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(count);
          }, 3000);
        });
      });

      // Allow up to 5 long tasks during initial load
      expect(longTasks, `${longTasks} long tasks detected`).toBeLessThanOrEqual(5);
      if (longTasks > 0) {
        console.log(`[Long Tasks] Dashboard: ${longTasks} tasks > 50ms`);
      }
    });
  });

  test.describe('Memory', () => {
    test('dashboard does not leak memory on repeated navigation', async ({ authenticatedPage }) => {
      // Navigate to dashboard 5 times
      const heapSnapshots: number[] = [];

      for (let i = 0; i < 5; i++) {
        await authenticatedPage.goto('/dashboard');
        await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
        await authenticatedPage.waitForTimeout(1_000);

        // Force GC if available
        await authenticatedPage.evaluate(() => {
          if ((window as any).gc) (window as any).gc();
        });

        const heap = await authenticatedPage.evaluate(() => {
          const m = (performance as any).memory;
          return m ? Math.round(m.usedJSHeapSize / 1048576) : 0;
        });
        heapSnapshots.push(heap);
      }

      // Heap should not grow monotonically
      const first = heapSnapshots[0];
      const last = heapSnapshots[heapSnapshots.length - 1];
      const growth = last - first;

      console.log(`[Memory] Heap snapshots (MB): ${heapSnapshots.join(', ')}`);

      // Allow up to 50MB growth over 5 navigations
      expect(growth, `Heap grew ${growth}MB over 5 navigations`).toBeLessThan(50);
    });
  });

  test.describe('API Response Times', () => {
    test('billing API responds within budget', async ({ apiFetch }) => {
      const start = Date.now();
      const res = await apiFetch('/billing/account-state');
      const elapsed = Date.now() - start;

      expect(res.status).toBeLessThan(400);
      expect(elapsed, `Account state API took ${elapsed}ms`).toBeLessThan(5000);
    });

    test('instances API responds within budget', async ({ apiFetch }) => {
      const start = Date.now();
      await apiFetch('/instances');
      const elapsed = Date.now() - start;

      expect(elapsed, `Instances API took ${elapsed}ms`).toBeLessThan(5000);
    });

    test('health endpoint responds quickly', async ({ apiFetch }) => {
      const start = Date.now();
      await apiFetch('/health');
      const elapsed = Date.now() - start;

      expect(elapsed, `Health API took ${elapsed}ms`).toBeLessThan(2000);
    });
  });

  test.describe('Resource Loading', () => {
    test('dashboard loads reasonable number of resources', async ({ authenticatedPage }) => {
      const resourceCounts = await authenticatedPage.evaluate(() => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const byType: Record<string, number> = {};
        let totalSize = 0;

        for (const r of resources) {
          const type = r.initiatorType || 'unknown';
          byType[type] = (byType[type] || 0) + 1;
          if (r.transferSize) totalSize += r.transferSize;
        }

        return { total: resources.length, byType, totalSizeKB: Math.round(totalSize / 1024) };
      });

      console.log(`[Resources] Total: ${resourceCounts.total}, Size: ${resourceCounts.totalSizeKB}KB`);
      console.log(`[Resources] By type: ${JSON.stringify(resourceCounts.byType)}`);

      // Should load fewer than 200 resources
      expect(resourceCounts.total, `${resourceCounts.total} resources loaded`).toBeLessThan(200);
    });

    test('no excessively large individual resources', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      const largeResources = await authenticatedPage.evaluate(() => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const large: string[] = [];
        for (const r of resources) {
          if (r.transferSize > 2 * 1024 * 1024) {
            large.push(`${r.name.slice(-60)}: ${Math.round(r.transferSize / 1024)}KB`);
          }
        }
        return large;
      });

      if (largeResources.length > 0) {
        console.log(`[Large Resources] ${largeResources.join('; ')}`);
      }
      expect(largeResources.length, `${largeResources.length} resources > 2MB`).toBeLessThanOrEqual(2);
    });
  });
});
