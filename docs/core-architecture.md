# Core Architecture

Aether Core is the sandbox runtime — a single Docker container running a Hono HTTP server (master, port 8000) that proxies to an OpenCode agent runtime (port 4096). Each Aether "instance" is one of these containers.

## Topology

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Container                      │
│                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │  master   │   │   OpenCode    │   │  User Services  │ │
│  │  :8000    │◄─►│   :4096       │   │  (nextjs/vite/  │ │
│  │  (Hono)   │   │  (agent RT)   │   │   python/etc)   │ │
│  └─────┬─────┘   └──────┬───────┘   └────────┬────────┘ │
│        │                │                     │          │
│        ▼                ▼                     ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              s6-overlay (process supervisor)      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐ │
│  │/workspace/│  │/ephemeral/ │  │/run/s6/ (tmpfs)      │ │
│  │(volume)   │  │(image)     │  │env dir, PID files    │ │
│  └──────────┘  └───────────┘  └──────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
              Nginx LB / Direct
                       │
              Browser / Mobile / SDK
```

## 3-Layer Persistence Model

| Layer | Path | Storage | Lifecycle |
|-------|------|---------|-----------|
| Persistent | `/workspace/` | Docker volume | Survives container restart & image updates |
| Ephemeral | `/ephemeral/` | Image layer | Replaced on image update |
| Runtime | `/run/s6/` | tmpfs | Rebuilt on every boot |

Key files in persistent layer:
- `/workspace/state/secrets.json` — encrypted secrets (AES-256-GCM)
- `/workspace/state/bootstrap-env.json` — plaintext bootstrap tokens
- `/workspace/auth.json` — OpenCode provider credentials
- `/workspace/state/share-store.json` — share proxy tokens
- `/workspace/state/triggers.db` — trigger state (SQLite)

Key files in runtime layer:
- `/run/s6/env/INTERNAL_SERVICE_KEY` — s6 env dir, rebuilt from bootstrap on boot
- `/run/s6/env/AETHER_TOKEN` — API auth token
- `/run/s6/env/AETHER_API_URL` — control plane URL

## Subsystems

### 1. Master Server (`master/src/index.ts`)

Hono v4 server on Bun runtime. Responsibilities:

- **Auth middleware**: Timing-safe SHA256 comparison of `INTERNAL_SERVICE_KEY` against `Authorization: Bearer` header. Localhost (`127.0.0.1`, `::1`) bypasses auth entirely.
- **WebSocket proxy**: Proxies `/ws` to OpenCode at `localhost:4096`. 10s connect timeout, 5min idle timeout, 1MB max message size.
- **Route registration**: Mounts proxy, env/secrets, services, shares, triggers, channels sub-apps.

Boot sequence:
```
startup.sh → s6-overlay → init-scripts → master server starts
  1. loadBootstrapEnv()     — reads bootstrap-env.json, writes to s6 env dir
  2. SecretStore.load()     — decrypts secrets.json, syncs to s6 env dir
  3. authSync()             — two-way sync auth.json ↔ s6 env / SecretStore
  4. ServiceManager.start() — detects framework, starts services in dependency order
```

### 2. Config (`master/src/config.ts`)

Port mapping from `SANDBOX_PORT_MAP` env var (format: `hostPort:containerPort`). Falls back to detecting the master port from `PORT` or defaults to 8000.

`getEnv()` reads from s6 env dir first, then `process.env`. This ensures bootstrap values (which may have been rotated) take precedence over Docker-level env vars.

### 3. ServiceManager (`master/src/services/service-manager.ts`)

~1400 lines managing the full service lifecycle.

**Two adapters**:
- `spawn`: user services (detected frameworks), managed as child processes
- `s6`: system services (opencode, chromium, sshd, etc.), managed via s6-overlay

**8 builtin services**: opencode-serve, chromium, browser (noVNC), sshd, docker, code-server, playwright, playwright-mcp.

**Service templates**: nextjs, vite, node, python, static — auto-detected from `/workspace/` contents.

**Key behaviors**:
- Topological sort for dependency-ordered startup
- Port allocation from available range
- Process monitoring with configurable restart policies
- PID namespace handling for cleanup
- Framework detection scans `/workspace/` for package.json, requirements.txt, etc.

### 4. SecretStore (`master/src/services/secret-store.ts`)

AES-256-GCM encryption with a dedicated random key (stored in `.encryption-key`). This key is **decoupled** from `INTERNAL_SERVICE_KEY` and `AETHER_TOKEN` — rotating the service key does not rotate the encryption key.

**5-store sync architecture**:

```
SecretStore (encrypted secrets.json)
    ↕
s6 env dir (/run/s6/env/)
    ↕
auth.json (OpenCode providers)  ←→  auth-sync.ts
    ↕
process.env (runtime)
    ↕
bootstrap-env.json (plaintext bootstrap)
```

On write, a secret propagates to all 5 stores. `set`/`delete` operations do **not** restart services — tools hot-read from the s6 env dir. `rotate-token` does restart OpenCode.

**Safety**: Never deletes undecryptable secrets. Backup-before-rotation. Async mutex for write serialization. v1→v2 migration with automatic upgrade.

### 5. Trigger System (`master/triggers/`)

Unified cron + webhook plugin.

```
TriggerManager
  ├── TriggerStore (SQLite)    — persistent trigger state
  ├── TriggerYaml              — file-based trigger definitions (synced to store)
  ├── CronScheduler            — cron expression evaluation
  ├── WebhookServer (:8099)    — receives external webhooks
  └── ActionDispatcher         — executes trigger actions
        ├── prompt  → sends prompt to OpenCode session
        ├── command → runs shell command
        └── http    → makes HTTP request
```

Triggers can be defined via YAML files or API. The YAML file is the source of truth; changes are synced to the SQLite store.

### 6. Share Proxy (`master/src/services/share-store.ts`)

Token-based public URL sharing with TTL.

- In-memory `Map<token, Share>` + periodic disk persistence
- TTL clamped to [5min, 365d]
- Token reuse for same port+label (idempotent)
- Pruning every 5 minutes for expired shares
- No auth on share URLs — **the token IS the auth**

## Data Flows

### Inbound HTTP Request

```
Client → Nginx → master :8000
  │
  ├─ Auth middleware: compare Bearer token vs INTERNAL_SERVICE_KEY
  │   └─ localhost? → skip auth
  │
  ├─ /ws → WebSocket proxy → OpenCode :4096
  ├─ /proxy/* → dynamic port proxy → user service
  ├─ /env/* → SecretStore CRUD → 5-store sync
  ├─ /services/* → ServiceManager lifecycle
  ├─ /shares/* → ShareStore CRUD
  ├─ /triggers/* → TriggerManager CRUD
  └─ /channels/* → channel message dispatch
```

### Outbound: Sandbox → API

```
Service in sandbox needs API
  → reads AETHER_TOKEN from s6 env dir / process.env
  → reads AETHER_API_URL from s6 env dir / process.env
  → HTTP request with Authorization: Bearer AETHER_TOKEN
  → aether API (control plane)
```

### Secret Write Flow

```
Client → PUT /env/secrets { key: "OPENAI_API_KEY", value: "sk-..." }
  → SecretStore.set()
    1. Encrypt value with AES-256-GCM
    2. Write to /workspace/state/secrets.json
    3. Write plaintext to /run/s6/env/OPENAI_API_KEY
    4. If provider key: update auth.json via auth-sync
    5. Update process.env
  → Response: { success: true }
  (no service restart — tools read from s6 env dir)
```

### Service Lifecycle

```
Container boot
  → startup.sh (persistent dirs, legacy migration, s6-overlay exec)
  → s6 init-scripts
  → master server starts
  → ServiceManager.start()
    1. Start builtin s6 services (opencode-serve, chromium, etc.)
    2. Detect framework in /workspace/
    3. Topological sort user services by dependency
    4. Allocate ports from available range
    5. Start user services in dependency order
    6. Monitor processes, restart on failure per policy
```

### Trigger Execution

```
Timer fires / Webhook received
  → CronScheduler / WebhookServer
  → TriggerManager evaluates matching triggers
  → ActionDispatcher.dispatch()
    ├─ prompt → OpenCode session API
    ├─ command → child_process.exec()
    └─ http → fetch()
  → Result logged to TriggerStore
```

### Channel Message Flow

```
External (Telegram/Slack)
  → Webhook → /channels/telegram or /channels/slack
  → Parse message, identify session
  → Dispatch to OpenCode session
  → OpenCode processes, generates response
  → Response sent back via channel CLI script
```

### Share Proxy Flow

```
Share creation:
  Client → POST /shares { port: 3000, ttl: 3600 }
  → ShareStore.create() → generate/random token → store in Map + disk
  → Response: { url: "https://sandbox-host/share/TOKEN" }

Share access:
  Visitor → GET /share/TOKEN
  → ShareStore.lookup(token) → check TTL → get target port
  → Proxy request to localhost:TARGET_PORT
  (no auth — token IS auth)
```

## Key Data Paths Summary

| Path | Source | Transport | Auth |
|------|--------|-----------|------|
| Inbound HTTP | Browser/SDK | HTTPS via Nginx | `INTERNAL_SERVICE_KEY` Bearer |
| Inbound WS | Browser/SDK | WSS via Nginx | `INTERNAL_SERVICE_KEY` Bearer |
| Proxy to OpenCode | master | localhost:4096 | None (localhost trust) |
| Proxy to user service | master | localhost:PORT | None (localhost trust) |
| Outbound to API | sandbox | HTTPS | `AETHER_TOKEN` Bearer |
| Share proxy | public | HTTPS | Token in URL path |

## Architecture Observations

### 1. Fat Proxy Pattern

Master is primarily a proxy/auth layer in front of OpenCode. Most "real" work (agent execution, tool calls, code generation) happens in OpenCode. Master adds auth, secret management, service orchestration, and sharing on top.

### 2. Encryption Key Decoupling

The SecretStore encryption key is independent of both `INTERNAL_SERVICE_KEY` and `AETHER_TOKEN`. This means rotating service credentials does not require re-encrypting all secrets — a good security property.

### 3. ServiceManager Scope

At ~1400 lines, ServiceManager handles framework detection, dependency resolution, port allocation, process lifecycle, and service templates. This is the most complex single module in core and the most likely source of bugs.

### 4. Dual Auth Identity

`INTERNAL_SERVICE_KEY` (external→sandbox auth) and `AETHER_TOKEN` (sandbox→API auth) serve different directions but are both stored in the same s6 env dir. Rotation of either is independent.

### 5. Localhost Trust Boundary

All internal communication (master↔OpenCode, master↔user services) uses localhost with no auth. The security boundary is at the container edge — if an attacker gets inside, they have full access.

### 6. Deep Startup Chain

The boot sequence is: `startup.sh` → `s6-overlay` → `init-scripts` → `master` → `loadBootstrapEnv` → `SecretStore.load` → `authSync` → `ServiceManager.start`. Each step depends on the previous, and failures can cascade.
