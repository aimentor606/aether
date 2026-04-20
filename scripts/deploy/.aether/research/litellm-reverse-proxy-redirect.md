# LiteLLM Reverse Proxy Redirect Fix — Research Report

## Problem
LiteLLM behind Kong Gateway returns `Location: http://llm-proxy:4000/ui/` in 307 redirects
instead of the public address `http://8.130.99.204/ui/`.

## Root Cause
LiteLLM runs on Uvicorn. When Kong proxies to it, Uvicorn generates redirect URLs using
the internal Docker hostname (`llm-proxy:4000`) because:

1. **Uvicorn doesn't trust X-Forwarded-* headers by default** — needs `proxy_headers=True`
2. **PR #24956** (FORWARDED_ALLOW_IPS support) is still **OPEN/unmerged** — setting this
   env var in the current LiteLLM Docker image does nothing
3. **Kong's `preserve_host: true`** passed the public Host header through, but LiteLLM
   still used its internal hostname for redirect URL construction

## Research Sources

### GitHub Issues (berriai/litellm)
- **#19663** — "Incorrect redirect URLs when LiteLLM is deployed in a distributed environment (k8s)"
  - Exact same symptoms: internal pod IPs in Location headers
  - Alpha fix image: `ghcr.io/berriai/litellm:fix_ui_proxy_redirects_v1.81.14_v2-v1.81.14-red`
- **#19856** — "LiteLLM UI redirects to /ui/login after oauth2-proxy auth"
- **#22272** — "Built-in LLM Passthrough Routes Fail with SERVER_ROOT_PATH"
- **#13968** — "/ui (no trailing slash) returns 307 to internal hostname"
- **#11451** — "Custom root path (still) does not work"
- **PR #24956** — Adds FORWARDED_ALLOW_IPS support (still open, April 2026)
- **PR #23532** — "fix(ui): resolve login redirect loop when reverse proxy adds HttpOnly to cookies" (MERGED)

### LiteLLM Environment Variables
| Variable | Purpose | Relevant? |
|----------|---------|-----------|
| `SERVER_ROOT_PATH` | Path prefix (e.g., `/api/v1`) | No — we don't use a prefix |
| `PROXY_BASE_URL` | Base URL for proxy | Maybe — but docs say not to set when no SERVER_ROOT_PATH |
| `FORWARDED_ALLOW_IPS` | Trust X-Forwarded headers | No — PR still open, not in current image |
| `ROOT_REDIRECT_URL` | Where `/` redirects to | No — `/ui` redirect is from Starlette StaticFiles |

### Kong Documentation
- Post-Function plugin: decK requires passing Lua via env vars, not inline in YAML
  - Source: https://docs.konghq.com/plugins/post-function
  - Pattern: `export DECK_FUNCTION=$(cat function.lua)` then use `${{ env "DECK_FUNCTION" }}`
- Response Transformer: cannot use regex in header replacement (only literal values)

## Fix Applied

### Two-layer approach:

1. **Kong request-transformer `set.headers Host`** — Overwrites the Host header sent to
   LiteLLM so it sees `8.130.99.204` instead of `llm-proxy:4000`. This fixes redirect
   URL generation at the source for most cases.

2. **Kong post-function Lua** — Rewrites any remaining `Location` headers that still
   contain `llm-proxy:PORT` as a safety net. Passed via env var (the recommended decK way)
   to avoid YAML escaping issues.

### Changes Made:
- `kong.yml`: Removed `preserve_host: true`, added `set.headers Host`, fixed Lua env var
- `litellm.yml`: Removed `FORWARDED_ALLOW_IPS=*` (doesn't work in current image)
- `sync-kong.sh`: Added `DECK_UI_REDIRECT_REWRITE` env var with Lua function

### Deploy Commands (VPS):
```bash
cd /data/deploy && git pull

# Restart Kong to reload config
bash ops/sync-kong.sh

# Verify
curl -v http://localhost/ui 2>&1 | grep -i location
# Expected: Location: http://8.130.99.204/ui/
# NOT: Location: http://llm-proxy:4000/ui/

# Also check full response
curl -v http://localhost/ui 2>&1 | head -20
```
