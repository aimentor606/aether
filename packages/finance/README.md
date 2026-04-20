# @aether/vertical-finance

Finance vertical for Aether multi-tenant SaaS platform.

## Overview

The Finance vertical provides domain-specific capabilities for financial organizations, including invoice generation, expense tracking, budget management, and tax compliance features.

## Features

- **Invoice Generation**: Automated invoice creation and management
- **Expense Tracking**: Comprehensive expense tracking and categorization
- **Budget Management**: Budget planning and monitoring tools
- **Tax Compliance**: Tax calculation and compliance reporting

## Integrations

- **Banking API**: Bank integration and transaction sync
- **Ledger Sync**: General ledger and accounting system synchronization
- **Accounting Software**: Integration with popular accounting platforms

## Configuration

```typescript
import { config } from '@aether/vertical-finance'

// Access finance-specific configuration
console.log(config.name)        // 'Finance'
console.log(config.type)        // 'finance'
console.log(config.integrations) // ['banking_api', 'ledger_sync', 'accounting_software']
console.log(config.featureFlags) // ['invoice_generation', ...]
```

## Directory Structure

- `src/prompts/` - AI prompts specific to finance workflows
- `src/schemas/` - Data schemas for finance entities
- `src/workflows/` - Finance-specific workflow definitions
- `src/integrations/` - Integration adapters for external finance systems

## Development

```bash
# Build
pnpm build

# Type check
pnpm type-check
```

## License

AGPL-3.0
