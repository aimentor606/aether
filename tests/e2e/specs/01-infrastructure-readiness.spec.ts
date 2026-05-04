import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const frontendUrl = process.env.E2E_BASE_URL || 'http://localhost:13737';
const apiUrl = process.env.E2E_API_URL || 'http://localhost:13738/v1';

function containerRunning(name: string): boolean {
  try {
    const out = execSync(`docker ps --format '{{.Names}}' --filter name=${name}`, {
      encoding: 'utf8',
      timeout: 10_000,
    });
    return out.trim().includes(name);
  } catch {
    return false;
  }
}

test.describe('Infrastructure Readiness', () => {
  test.describe('Docker Containers', () => {
    const containers = [
      { name: 'aether-frontend', label: 'Frontend' },
      { name: 'aether-aether-api', label: 'API' },
      { name: 'aether-supabase-auth', label: 'Supabase Auth' },
      { name: 'aether-supabase-kong', label: 'Supabase Kong' },
      { name: 'aether-supabase-db', label: 'Supabase DB' },
    ];

    for (const { name, label } of containers) {
      test(`${label} container is running`, () => {
        expect(containerRunning(name), `${name} not running`).toBe(true);
      });
    }
  });

  test.describe('Service Health', () => {
    test('Frontend responds', async () => {
      const res = await fetch(`${frontendUrl}/auth`);
      expect(res.status).toBe(200);
    });

    test('API health check passes', async () => {
      const res = await fetch(`${apiUrl}/health`);
      expect(res.status).toBe(200);
    });
  });
});
