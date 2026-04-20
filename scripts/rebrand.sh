#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Rebrand Codemod — Idempotent Brand Replacement Script                     ║
# ║                                                                            ║
# ║  Replaces all "kortix" references with your brand name.                    ║
# ║  Run after each upstream merge to re-apply your brand.                     ║
# ║                                                                            ║
# ║  Usage:  BRAND=yourbrand bash scripts/rebrand.sh                           ║
# ║  Config: scripts/rebrand.config.json (optional, overrides env vars)        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/rebrand.config.json"

if [[ -f "$CONFIG_FILE" ]]; then
  BRAND="${BRAND:-$(python3 -c "import json,sys; print(json.load(open('$CONFIG_FILE')).get('brandName',''))" 2>/dev/null)}"
  BRAND_DOMAIN="${BRAND_DOMAIN:-$(python3 -c "import json,sys; print(json.load(open('$CONFIG_FILE')).get('brandDomain',''))" 2>/dev/null)}"
  BRAND_TWITTER="${BRAND_TWITTER:-$(python3 -c "import json,sys; print(json.load(open('$CONFIG_FILE')).get('brandTwitter',''))" 2>/dev/null)}"
fi

BRAND="${BRAND:?Set BRAND env var. Example: BRAND=aether bash scripts/rebrand.sh}"
BRAND_DOMAIN="${BRAND_DOMAIN:-${BRAND}.com}"
BRAND_TWITTER="${BRAND_TWITTER:-@${BRAND}}"
BRAND_UPPER="$(echo "$BRAND" | tr '[:lower:]' '[:upper:]')"
BRAND_CAP="$(echo "${BRAND:0:1}" | tr '[:lower:]' '[:upper:]')${BRAND:1}"
BRAND_PASCAL="$(echo "$BRAND" | sed 's/\(^\|-\)\([a-z]\)/\1\U\2/g' | tr -d '-')"

if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
  echo "ERROR: No package.json at $PROJECT_ROOT" && exit 1
fi

if sed --version 2>/dev/null | grep -q GNU; then
  SI="sed -i"; else SI="sed -i ''"
fi

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { printf "  ${CYAN}▸${NC} %s\n" "$*"; }
success() { printf "  ${GREEN}✓${NC} %s\n" "$*"; }
warn()    { printf "  ${YELLOW}!${NC} %s\n" "$*"; }

# ── File finder that excludes node_modules, .git, .next, dist, AND this script ──
sf() {
  find . \( \
    -path '*/node_modules/*' -o -path '*/.next/*' -o -path '*/dist/*' -o \
    -path '*/.git/*' -o -path '*/.turbo/*' -o -path '*/coverage/*' -o \
    -name 'rebrand.sh' -o -name 'rebrand.config.json' \
  \) -prune -o \( "$@" \) -print
}

cd "$PROJECT_ROOT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Rebrand:master → ${BRAND}"
echo "  Rebrand: aether → ${BRAND}"
echo "  Domain: ${BRAND_DOMAIN}  Twitter: ${BRAND_TWITTER}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: Package names (@kortix/* → @brand/*, npm: → workspace:)
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 1: Package names"

sf -name 'package.json' -type f | while read -r f; do
  eval "$SI \
    -e 's/npm:@kortix\//workspace:@${BRAND}\//g' \
    -e 's/@kortix\//@${BRAND}\//g' \
    -e 's/\"kortix-api\"/\"${BRAND}-api\"/g' \
    -e 's/\"kortix\"/\"${BRAND}\"/g' \
    -e 's/\"Kortix-Computer-Frontend\"/\"${BRAND_PASCAL}-Frontend\"/g' \
    '$f'"
done

[[ -f "pnpm-workspace.yaml" ]] && eval "$SI 's/@kortix\//@${BRAND}\//g' pnpm-workspace.yaml"

sf -type f \( -name '*.ts' -o -name '*.tsx' \) | while read -r f; do
  eval "$SI -e 's/@kortix\//@${BRAND}\//g' -e 's/from[[:space:]]*[\"'\'']kortix-api/from '\"'\"'${BRAND}-api/g' '$f'"
done

sf -type f \( -name '*.js' -o -name '*.jsx' \) | while read -r f; do
  eval "$SI -e 's/@kortix\//@${BRAND}\//g' '$f'"
done

success "Phase 1 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: Environment variables (KORTIX_* → BRAND_*)
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 2: Environment variables"

sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.env*' -o -name '*.sh' \) | while read -r f; do
  eval "$SI \
    -e 's/KORTIX_PUBLIC_/${BRAND_UPPER}_PUBLIC_/g' \
    -e 's/KORTIX_SUPABASE_AUTH_COOKIE/${BRAND_UPPER}_SUPABASE_AUTH_COOKIE/g' \
    -e 's/KORTIX_BILLING_INTERNAL_ENABLED/${BRAND_UPPER}_BILLING_INTERNAL_ENABLED/g' \
    -e 's/KORTIX_DEPLOYMENTS_ENABLED/${BRAND_UPPER}_DEPLOYMENTS_ENABLED/g' \
    -e 's/KORTIX_LOCAL_IMAGES/${BRAND_UPPER}_LOCAL_IMAGES/g' \
    -e 's/KORTIX_MARKETPLACE_NAMESPACE/${BRAND_UPPER}_MARKETPLACE_NAMESPACE/g' \
    -e 's/KORTIX_MARKETPLACE_REGISTRY_URL/${BRAND_UPPER}_MARKETPLACE_REGISTRY_URL/g' \
    -e 's/KORTIX_MARKETPLACE_INSTALLED_QUERY_KEY/${BRAND_UPPER}_MARKETPLACE_INSTALLED_QUERY_KEY/g' \
    -e 's/KORTIX_DEEP_LINK/${BRAND_UPPER}_DEEP_LINK/g' \
    -e 's/KORTIX_TOKEN/${BRAND_UPPER}_TOKEN/g' \
    -e 's/KORTIX_API_URL/${BRAND_UPPER}_API_URL/g' \
    -e 's/KORTIX_URL/${BRAND_UPPER}_URL/g' \
    -e 's/INTERNAL_KORTIX_ENV/INTERNAL_${BRAND_UPPER}_ENV/g' \
    -e 's/KORTIX_/${BRAND_UPPER}_/g' \
    '$f'"
done

find . -maxdepth 3 -name '.env*' -not -path '*/node_modules/*' | while read -r f; do
  eval "$SI -e 's/KORTIX_PUBLIC_/${BRAND_UPPER}_PUBLIC_/g' -e 's/KORTIX_/${BRAND_UPPER}_/g' '$f'"
done

success "Phase 2 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: Runtime config globals
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 3: Runtime config globals"

sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.html' \) | while read -r f; do
  eval "$SI -e 's/__KORTIX_RUNTIME_CONFIG/__${BRAND_UPPER}_RUNTIME_CONFIG/g' '$f'"
done

success "Phase 3 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: User-visible strings
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 4: User-visible strings"

sf -type f \( -name '*.ts' -o -name '*.tsx' \) -path '*/apps/web/*' | while read -r f; do
  eval "$SI -e 's/Kortix/${BRAND_CAP}/g' '$f'"
done

if [[ -d "apps/web/translations" ]]; then
  sf -type f -name '*.json' -path '*/translations/*' | while read -r f; do
    eval "$SI 's/Kortix/${BRAND_CAP}/g' '$f'"
  done
fi

if [[ -f "apps/web/src/lib/site-metadata.ts" ]]; then
  eval "$SI -e 's/kortix\.com/${BRAND_DOMAIN}/g' -e 's/www\.kortix\.com/www.${BRAND_DOMAIN}/g' -e 's/Kortix/${BRAND_CAP}/g' apps/web/src/lib/site-metadata.ts"
fi

if [[ -f "apps/web/src/app/layout.tsx" ]]; then
  eval "$SI -e 's/Kortix Team/${BRAND_CAP} Team/g' -e 's/www\.kortix\.com/www.${BRAND_DOMAIN}/g' -e 's/@kortix/${BRAND_TWITTER}/g' apps/web/src/app/layout.tsx"
fi

sf -type f -name 'README.md' | while read -r f; do
  eval "$SI -e 's/kortix-ai\/suna/aimentor606\/aether/g' -e 's/Kortix/${BRAND_CAP}/g' '$f'"
done

success "Phase 4 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: Auth cookies and API key prefixes
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 5: Auth cookies and API key prefixes"

sf -type f \( -name '*.ts' -o -name '*.tsx' \) | while read -r f; do
  eval "$SI -e 's/sb-kortix-auth-token/sb-${BRAND}-auth-token/g' -e 's/kortix_sb_/${BRAND}_sb_/g' '$f'"
done

success "Phase 5 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6: Docker images, containers, CLI commands, domains
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 6: Docker, CLI, domains"

sf -type f \( -name '*.yml' -o -name '*.yaml' -o -name '*.ts' -o -name '*.sh' \) | while read -r f; do
  eval "$SI \
    -e 's/kortix\/computer/${BRAND}\/computer/g' \
    -e 's/kortix\/kortix-frontend/${BRAND}\/${BRAND}-frontend/g' \
    -e 's/kortix\/kortix-api/${BRAND}\/${BRAND}-api/g' \
    -e 's/kortix-computer/${BRAND}-computer/g' \
    -e 's/kortix-sandbox/${BRAND}-sandbox/g' \
    '$f'"
done

sf -type f \( -name '*.sh' -o -name '*.ts' -o -name '*.md' \) | while read -r f; do
  eval "$SI \
    -e 's/kortix start/${BRAND} start/g' -e 's/kortix stop/${BRAND} stop/g' \
    -e 's/kortix restart/${BRAND} restart/g' -e 's/kortix logs/${BRAND} logs/g' \
    -e 's/kortix status/${BRAND} status/g' -e 's/kortix update/${BRAND} update/g' \
    -e 's/kortix reset/${BRAND} reset/g' -e 's/kortix uninstall/${BRAND} uninstall/g' \
    '$f'"
done

sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.yml' \) | while read -r f; do
  eval "$SI -e 's/kortix\.cloud/${BRAND}.cloud/g' -e 's/api\.kortix\.com/api.${BRAND_DOMAIN}/g' -e 's/kortix\.com/${BRAND_DOMAIN}/g' '$f'"
done

success "Phase 6 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7: Marketplace and deep links
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 7: Marketplace and deep links"

sf -type f \( -name '*.ts' -o -name '*.tsx' \) | while read -r f; do
  eval "$SI -e \"s/'kortix'/'${BRAND}'/g\" -e 's/kortix:\/\//"${BRAND}":\/\//g' -e 's/com\.kortix\.app/com."${BRAND}".app/g' '$f'"
done

success "Phase 7 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 8:system XML tags (skip with SKIP_XML_TAGS=1)
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 8: XML tags"

if [[ "${SKIP_XML_TAGS:-0}" != "1" ]]; then
  sf -type f \( -name '*.ts' -o -name '*.tsx' \) | while read -r f; do
    eval "$SI \
      -e 's/kortix_system/${BRAND}_system/g' -e 's/kortix-system/${BRAND}-system/g' \
      -e 's/KORTIX_SYSTEM/${BRAND_UPPER}_SYSTEM/g' -e 's/KORTIX_SYSTEM_RE/${BRAND_UPPER}_SYSTEM_RE/g' \
      -e 's/stripKortixSystemTags/strip${BRAND_PASCAL}SystemTags/g' \
      -e 's/isKortixSystemOnly/is${BRAND_PASCAL}SystemOnly/g' \
      '$f'"
  done
else
  warn "Skipping XML tag replacement (SKIP_XML_TAGS=1)"
fi

success "Phase 8 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 9: Install script
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 9: Install script"

if [[ -f "scripts/get-kortix.sh" ]]; then
  eval "$SI \
    -e 's/kortix\.com\/install/${BRAND_DOMAIN}\/install/g' \
    -e 's/kortix start/${BRAND} start/g' -e 's/kortix stop/${BRAND} stop/g' \
    -e 's/kortix restart/${BRAND} restart/g' -e 's/kortix logs/${BRAND} logs/g' \
    -e 's/kortix status/${BRAND} status/g' -e 's/kortix update/${BRAND} update/g' \
    -e 's/kortix reset/${BRAND} reset/g' -e 's/kortix uninstall/${BRAND} uninstall/g' \
    -e 's/Kortix/${BRAND_CAP}/g' scripts/get-kortix.sh"
fi

success "Phase 9 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 10: camelCase/kebab-case identifiers
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 10: Identifiers (camelCase, kebab-case, Stripe IDs)"

sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) | while read -r f; do
  eval "$SI \
    -e 's/kortixSchema/${BRAND}Schema/g' -e 's/kortixApiKeys/${BRAND}ApiKeys/g' \
    -e 's/kortixTokenHeader/${BRAND}TokenHeader/g' -e 's/kortixApiUrl/${BRAND}ApiUrl/g' \
    -e 's/kortixKeys/${BRAND}Keys/g' -e 's/kortixFetch/${BRAND}Fetch/g' \
    -e 's/kortixTargetBaseUrl/${BRAND}TargetBaseUrl/g' -e 's/kortixTaskFetch/${BRAND}TaskFetch/g' \
    -e 's/kortixProxyHandler/${BRAND}ProxyHandler/g' -e 's/kortixUrl/${BRAND}Url/g' \
    -e 's/kortix_plus_monthly/${BRAND}_plus_monthly/g' -e 's/kortix_pro_monthly/${BRAND}_pro_monthly/g' \
    -e 's/kortix_team/${BRAND}_team/g' -e 's/kortix_owner/${BRAND}_owner/g' \
    -e 's/kortix_unique_stripe_event/${BRAND}_unique_stripe_event/g' \
    '$f'"
done

sf -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' -o -name '*.html' \) | while read -r f; do
  eval "$SI \
    -e 's/kortix-loader/${BRAND}-loader/g' -e 's/kortix-sandbox/${BRAND}-sandbox/g' \
    -e 's/kortix-logo/${BRAND}-logo/g' -e 's/kortix-logomark-white/${BRAND}-logomark-white/g' \
    -e 's/kortix-symbol/${BRAND}-symbol/g' -e 's/kortix-tool-output/${BRAND}-tool-output/g' \
    -e 's/kortix-start-sandbox/${BRAND}-start-sandbox/g' -e 's/kortix-update/${BRAND}-update/g' \
    -e 's/kortix-tabs-per-server/${BRAND}-tabs-per-server/g' \
    -e 's/kortix-computer-store/${BRAND}-computer-store/g' -e 's/kortix-projects/${BRAND}-projects/g' \
    -e 's/kortix-last-user-id/${BRAND}-last-user-id/g' -e 's/kortix-data/${BRAND}-data/g' \
    -e 's/kortix-token/${BRAND}-token/g' -e 's/kortix-power/${BRAND}-power/g' \
    -e 's/kortix-portal-root/${BRAND}-portal-root/g' -e 's/kortix-onboarding-skip/${BRAND}-onboarding-skip/g' \
    -e 's/kortix-onboarding-redo/${BRAND}-onboarding-redo/g' \
    -e 's/kortix-markdown_li/${BRAND}-markdown_li/g' -e 's/kortix-markdown_div/${BRAND}-markdown_div/g' \
    -e 's/kortix-container-shell/${BRAND}-container-shell/g' \
    -e 's/kortix-connectors/${BRAND}-connectors/g' -e 's/kortix-authorized-keys/${BRAND}-authorized-keys/g' \
    '$f'"
done

success "Phase 10 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 11: Catch-all (emails, GitHub, misc)
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 11: Catch-all"

sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.md' \) | while read -r f; do
  eval "$SI \
    -e 's/hello@kortix\.com/hello@${BRAND_DOMAIN}/g' \
    -e 's/support@kortix\.com/support@${BRAND_DOMAIN}/g' \
    -e 's/team@kortix\.com/team@${BRAND_DOMAIN}/g' \
    -e 's/kortix-ai\/suna/aimentor606\/aether/g' \
    '$f'"
done

sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) | while read -r f; do
  eval "$SI -e 's/kortix-registry/${BRAND}-registry/g' -e 's/kortix-computer/${BRAND}-computer/g' '$f'"
done

[[ -f "apps/web/public/manifest.json" ]] && eval "$SI -e 's/kortix/${BRAND}/g' -e 's/Kortix/${BRAND_CAP}/g' apps/web/public/manifest.json"
[[ -f "apps/web/public/.well-known/assetlinks.json" ]] && eval "$SI 's/com\.kortix\.app/com.${BRAND}.app/g' apps/web/public/.well-known/assetlinks.json"

success "Phase 11 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 12: Blanket — any remainingmaster (excluding core/master/ dirs)
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 12: Blanket catch-all"

sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o \
  -name '*.json' -o -name '*.css' -o -name '*.html' -o -name '*.yml' -o -name '*.yaml' -o \
  -name '*.sh' -o -name '*.md' -o -name '*.env*' -o -name '*.sql' \) \
  | grep -v 'core/master' \
  | grep -v 'packages/kortix-ocx-registry' \
  | grep -v 'schema/kortix\.ts' \
  | while read -r f; do
  eval "$SI -e 's/kortix/${BRAND}/g' -e 's/Kortix/${BRAND_CAP}/g' -e 's/KORTIX/${BRAND_UPPER}/g' '$f'"
done

success "Phase 12 done"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 13: File and directory renames
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 13: File and directory renames"

# Skip if explicitly disabled
if [[ "${SKIP_FILE_RENAMES:-0}" != "1" ]]; then
  # ── Rename files (not directories) containing 'kortix' in name ──
  # Exclude: core/master/*, core/kortix-ocx/*, packages/kortix-ocx-registry/*,
  #          packages/kortix-ai/*, packages/db/src/schema/kortix.ts, node_modules

  while IFS= read -r oldpath; do
    # Skip excluded paths (directory names we intentionally keep)
    case "$oldpath" in
      */node_modules/*|*/.git/*|*/core/kortix-*|*/packages/kortix-*) continue ;;
      */schema/kortix.ts) continue ;;
      */core/s6-services/svc-master*) continue ;;
      */core/init-scripts/kortix-env-setup.sh) continue ;;
    esac

    dir="$(dirname "$oldpath")"
    base="$(basename "$oldpath")"
    newbase="$(echo "$base" | sed "s/kortix/${BRAND}/g; s/Kortix/${BRAND_CAP}/g")"

    if [[ "$base" != "$newbase" ]]; then
      newpath="${dir}/${newbase}"
      if [[ ! -e "$newpath" ]]; then
        mv "$oldpath" "$newpath"
        info "  Renamed: $oldpath → $newpath"
      fi
    fi
  done < <(find . -type f -name '*kortix*' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null)

  # ── Rename directories containing 'kortix' (bottom-up to avoid nesting issues) ──
  # Exclude: core/master, core/kortix-ocx, packages/kortix-*, svc-master
  while IFS= read -r oldpath; do
    case "$oldpath" in
      */node_modules/*|*/.git/*) continue ;;
      ./core/kortix-*|./packages/kortix-*) continue ;;
      */core/kortix-*|*/packages/kortix-*) continue ;;
      *svc-master*) continue ;;
      *kortix-env-setup*) continue ;;
    esac

    dir="$(dirname "$oldpath")"
    base="$(basename "$oldpath")"
    newbase="$(echo "$base" | sed "s/kortix/${BRAND}/g; s/Kortix/${BRAND_CAP}/g")"

    if [[ "$base" != "$newbase" ]]; then
      newpath="${dir}/${newbase}"
      if [[ ! -e "$newpath" ]]; then
        mv "$oldpath" "$newpath"
        info "  Renamed dir: $oldpath → $newpath"
      fi
    fi
  done < <(find . -type d -name '*kortix*' -not -path '*/node_modules/*' -not -path '*/.git/*' -depth 2>/dev/null)

  # ── Update any import paths that reference renamed files ──
  sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) | while read -r f; do
    eval "$SI \
      -e 's|from.*[\"'\''].*/kortix-projects|from '\"'\"'./${BRAND}-projects|g' \
      -e 's|from.*[\"'\''].*/kortix-computer|from '\"'\"'./${BRAND}-computer|g' \
      -e 's|from.*[\"'\''].*/kortix-loader|from '\"'\"'./${BRAND}-loader|g' \
      -e 's|from.*[\"'\''].*/kortix-logo|from '\"'\"'./${BRAND}-logo|g' \
      '$f'"
  done

  success "Phase 13 done"
else
  warn "Skipping file/directory renames (SKIP_FILE_RENAMES=1)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 14: aether → Brand replacements
# ══════════════════════════════════════════════════════════════════════════════
info "Phase 14: aether brand replacements"

# Package names: @aether/* → @brand/*
sf -name 'package.json' -type f | while read -r f; do
  eval "$SI \
    -e 's/@aether\//@${BRAND}\//g' \
    -e 's/\"aether-Frontend\"/\"${BRAND_PASCAL}-Frontend\"/g' \
    -e 's/\"aether\"/\"${BRAND}\"/g' \
    '$f'"
done

# Import statements: @aether/* → @brand/*
sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) | while read -r f; do
  eval "$SI -e 's/@aether\//@${BRAND}\//g' '$f'"
done

# Environment variables: aether_* → BRAND_*
sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.env*' -o -name '*.sh' \) | while read -r f; do
  eval "$SI \
    -e 's/aether_PUBLIC_/${BRAND_UPPER}_PUBLIC_/g' \
    -e 's/aether_SUPABASE_AUTH_COOKIE/${BRAND_UPPER}_SUPABASE_AUTH_COOKIE/g' \
    -e 's/aether_BILLING_INTERNAL_ENABLED/${BRAND_UPPER}_BILLING_INTERNAL_ENABLED/g' \
    -e 's/aether_DEPLOYMENTS_ENABLED/${BRAND_UPPER}_DEPLOYMENTS_ENABLED/g' \
    -e 's/aether_LOCAL_IMAGES/${BRAND_UPPER}_LOCAL_IMAGES/g' \
    -e 's/aether_MARKUP/${BRAND_UPPER}_MARKUP/g' \
    -e 's/aether_DATA_DIR/${BRAND_UPPER}_DATA_DIR/g' \
    -e 's/aether_WORKSPACE_ROOT/${BRAND_UPPER}_WORKSPACE_ROOT/g' \
    -e 's/aether_WORKSPACE/${BRAND_UPPER}_WORKSPACE/g' \
    -e 's/aether_TOKEN/${BRAND_UPPER}_TOKEN/g' \
    -e 's/aether_API_URL/${BRAND_UPPER}_API_URL/g' \
    -e 's/aether_URL/${BRAND_UPPER}_URL/g' \
    -e 's/aether_MASTER_URL/${BRAND_UPPER}_MASTER_URL/g' \
    -e 's/INTERNAL_aether_ENV/INTERNAL_${BRAND_UPPER}_ENV/g' \
    -e 's/aether_SKIP_ENSURE_SCHEMA/${BRAND_UPPER}_SKIP_ENSURE_SCHEMA/g' \
    -e 's/aether_/${BRAND_UPPER}_/g' \
    '$f'"
done

# HTTP headers: X-aether-Token → X-Brand-Token
sf -type f \( -name '*.ts' -o -name '*.tsx' \) | while read -r f; do
  eval "$SI \
    -e 's/X-aether-Token/X-${BRAND_PASCAL}-Token/g' \
    -e 's/x-aether-token/x-${BRAND}-token/g' \
    '$f'"
done

# API key prefixes: aether_ → brand_ (with backward compat note)
sf -type f \( -name '*.ts' -o -name '*.tsx' \) | while read -r f; do
  eval "$SI \
    -e 's/aether_sb_/${BRAND}_sb_/g' \
    -e 's/aether_tnl_/${BRAND}_tnl_/g' \
    -e 's/aether_/${BRAND}_/g' \
    '$f'"
done

# User-visible strings: aether → Brand
sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.md' \) -not -path '*/packages/db/drizzle/*' | while read -r f; do
  eval "$SI -e 's/aether/${BRAND_CAP}/g' '$f'"
done

# Docker images: aether/computer → brand/computer
sf -type f \( -name '*.ts' -o -name '*.yml' -o -name '*.yaml' -o -name '*.sh' \) | while read -r f; do
  eval "$SI \
    -e 's/aether\/computer/${BRAND}\/computer/g' \
    -e 's/aether-sandbox/${BRAND}-sandbox/g' \
    -e 's/aether-api/${BRAND}-api/g' \
    -e 's/aether\/aether-api/${BRAND}\/${BRAND}-api/g' \
    '$f'"
done

# Domains: aether.dev → brand.dev etc
sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.yml' -o -name '*.md' \) | while read -r f; do
  eval "$SI -e 's/aether\.dev/${BRAND}.dev/g' -e 's/aether\.cloud/${BRAND}.cloud/g' -e 's/aether\.ai/${BRAND}.ai/g' '$f'"
done

# CamelCase/kebab identifiers: aetherSchema, aether-computer-store etc
sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.css' \) | while read -r f; do
  eval "$SI \
    -e 's/aetherSchema/${BRAND}Schema/g' \
    -e 's/aetherApiKeys/${BRAND}ApiKeys/g' \
    -e 's/aether-computer-store/${BRAND}-computer-store/g' \
    -e 's/aether-loader/${BRAND}-loader/g' \
    -e 's/aether-logo/${BRAND}-logo/g' \
    -e 's/aether-enterprise-modal/${BRAND}-enterprise-modal/g' \
    -e 's/aether-tool-output/${BRAND}-tool-output/g' \
    -e 's/aether-system-tags/${BRAND}-system-tags/g' \
    -e 's/aether-box-display/${BRAND}-box-display/g' \
    -e 's/aether-spreadsheet/${BRAND}-spreadsheet/g' \
    '$f'"
done

# File renames: aether-* → brand-*
if [[ "${SKIP_FILE_RENAMES:-0}" != "1" ]]; then
  while IFS= read -r oldpath; do
    case "$oldpath" in
      */node_modules/*|*/.git/*|*/drizzle/*) continue ;;
    esac
    dir="$(dirname "$oldpath")"
    base="$(basename "$oldpath")"
    newbase="$(echo "$base" | sed "s/aether/${BRAND}/g; s/aether/${BRAND_CAP}/g")"
    if [[ "$base" != "$newbase" && ! -e "${dir}/${newbase}" ]]; then
      mv "$oldpath" "${dir}/${newbase}"
      info "  Renamed: $oldpath → ${dir}/${newbase}"
    fi
  done < <(find . -type f -name '*aether*' -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/drizzle/*' 2>/dev/null)
fi

success "Phase 14 done"
# VERIFICATION
# ══════════════════════════════════════════════════════════════════════════════
echo ""
info "Verification: scanning for remainingmaster references..."

remaining=$(sf -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' -o -name '*.sh' -o -name '*.yml' -o -name '*.md' \) 2>/dev/null \
  | grep -v 'core/master' \
  | grep -v 'packages/kortix-ocx-registry' \
  | grep -v 'packages/db/drizzle' \
  | xargs grep -il 'kortix\|aether' 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "${remaining:-0}" -eq 0 ]]; then
  success "Rebrand complete: kortix/aether → ${BRAND} — no stray references found"
else
  warn "${remaining} files still contain 'kortix' or 'aether' (allowed dirs or comments)"
fi
echo ""
warn "Run to verify:  pnpm install && pnpm build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
