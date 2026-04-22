# TODO: LiteLLM Custom Callback for Real-Time Billing

**Status:** Deferred optimization
**Priority:** Medium
**Depends on:** Phase 1 (credentials) and Phase 2 (Kong routing) complete

## Current Approach

Spend reconciliation polls LiteLLM `/key/list` every 30 seconds and deducts delta from Aether credits.

## Proposed Optimization

Configure LiteLLM's custom success callback to POST to an Aether webhook after each LLM request. This gives real-time billing instead of 30s polling.

### Implementation Sketch

1. Add webhook endpoint: `POST /v1/control/billing/webhook` (authenticated with shared secret)
2. Configure LiteLLM `general_settings.success_callback` to call this webhook
3. Webhook receives per-request spend data and calls `deductCredits()` immediately
4. Keep reconciliation cron as a safety net (catches missed webhooks)

### Benefits

- Sub-second billing accuracy instead of 30s lag
- Users see credit deductions immediately after each request
- Reduces reconciliation complexity (webhook is primary, reconciliation is backup)

### References

- LiteLLM custom callbacks: https://docs.litellm.ai/docs/proxy/custom_callbacks
- Current reconciler: `apps/api/src/router/services/spend-reconciler.ts`
