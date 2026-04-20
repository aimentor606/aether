import { describe, test, expect } from 'bun:test';
import { buildCustomerCloudInitScript } from '../platform/providers/justavps';

describe('JustAVPS provider bootstrap script resolution', () => {
  test('buildCustomerCloudInitScript embeds sandbox bootstrap', () => {
    const script = buildCustomerCloudInitScript('aether/computer:0.8.20');
    expect(script).toContain('/usr/local/bin/aether-start-sandbox.sh');
    expect(script).toContain('aether/computer:0.8.20');
    expect(script).toContain('raw.githubusercontent.com/aimentor606/aether/main/scripts/start-sandbox.sh');
  });
});
