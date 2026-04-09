import { describe, test, expect } from 'bun:test';
import { buildCustomerCloudInitScript } from '../platform/providers/justavps';

describe('JustAVPS provider bootstrap script resolution', () => {
  test('buildCustomerCloudInitScript embeds sandbox bootstrap', () => {
    const script = buildCustomerCloudInitScript('acme/computer:0.8.20');
    expect(script).toContain('/usr/local/bin/acme-start-sandbox.sh');
    expect(script).toContain('acme/computer:0.8.20');
    expect(script).toContain('raw.githubusercontent.com/aimentor606/aether/main/scripts/start-sandbox.sh');
  });
});
