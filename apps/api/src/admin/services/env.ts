import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

// ─── Path Resolution ────────────────────────────────────────────────────────

export function findRepoRoot(): string | null {
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '../..'),
    resolve(__dirname, '../../../..'),
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, 'docker-compose.local.yml'))) {
      return dir;
    }
  }
  return null;
}

export function getProjectRoot(): string {
  return findRepoRoot() ?? process.cwd();
}

// ─── Env File I/O ───────────────────────────────────────────────────────────

export async function parseEnvFile(path: string): Promise<Record<string, string>> {
  if (!existsSync(path)) return {};
  const content = await readFile(path, 'utf-8');
  const env: Record<string, string> = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if (val.length >= 2) {
      const first = val.charCodeAt(0);
      const last = val.charCodeAt(val.length - 1);
      if ((first === 0x22 && last === 0x22) || (first === 0x27 && last === 0x27)) {
        val = val.slice(1, -1);
      }
    }
    env[key] = val;
  }
  return env;
}

export function maskKey(val: string): string {
  if (!val || val.length < 8) return val ? '****' : '';
  return val.slice(0, 4) + '...' + val.slice(-4);
}

export async function writeEnvFile(path: string, data: Record<string, string>): Promise<void> {
  const existing = existsSync(path) ? await readFile(path, 'utf-8') : '';
  const lines = existing.split('\n');
  const written = new Set<string>();
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      out.push(raw);
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) { out.push(raw); continue; }
    const key = line.slice(0, idx).trim();
    if (key in data) {
      out.push(`${key}=${data[key]}`);
      written.add(key);
    } else {
      out.push(raw);
    }
  }

  for (const [key, val] of Object.entries(data)) {
    if (!written.has(key)) {
      out.push(`${key}=${val}`);
    }
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, out.join('\n') + '\n');
}
