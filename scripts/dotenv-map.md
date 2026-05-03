# .env File Ownership Map

Reference for all .env files in the project and which scripts own (write) or read them.

## .env Locations

| File | Owner (writes) | Readers | Purpose |
|------|---------------|---------|---------|
| `.env` (repo root) | Manual / user | `setup-env.sh` | Master env: all secrets in one place |
| `apps/api/.env` | `setup-env.sh`, `dev-prod.sh` | API runtime, `zero-downtime.sh` | API config (DB, auth, integrations) |
| `apps/api/.env.prod` | Manual | `dev-prod.sh` | Production credentials for local dev |
| `apps/web/.env` | `setup-env.sh` | Next.js runtime | Frontend config |
| `apps/web/.env.local` | `dev-prod.sh` | Next.js runtime | Production frontend override |
| `scripts/supabase/.env` | `generate-keys.sh`, `add-new-auth-keys.sh`, `rotate-new-api-keys.sh`, `db-passwd.sh`, `reset.sh` | Supabase docker-compose, all `supabase/utils/*` | Self-hosted Supabase secrets |
| `scripts/deploy/ops/.env` | Manual | All `deploy/ops/*` scripts | Production deploy secrets |

## Management Commands

### Dev environment
```bash
bash scripts/setup-env.sh            # Generate apps/api/.env + apps/web/.env from root .env
```

### Self-hosted Supabase (scripts/supabase/.env)
```bash
sh scripts/supabase/utils/manage-keys.sh generate --update-env   # First-time: all secrets
sh scripts/supabase/utils/manage-keys.sh add-auth --update-env   # Add asymmetric keys
sh scripts/supabase/utils/manage-keys.sh rotate-api --update-env # Rotate opaque API keys
sh scripts/supabase/utils/manage-keys.sh reset-passwords          # Reset DB role passwords
```

### Production deploy (scripts/deploy/ops/.env)
```bash
# Copy from .env.example and fill in values manually
cp scripts/deploy/ops/.env.example scripts/deploy/ops/.env
```

## Key Principles

- **One owner per .env**: Each .env file has exactly one script that writes to it (except supabase/.env which has a dedicated manage-keys.sh entry point)
- **Never commit .env files**: All .env files are in .gitignore
- **Template files (.env.example) are committed**: These document required variables without secrets
