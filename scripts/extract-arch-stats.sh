#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  Bubble Architecture Stats Extractor
#  
#  Genererer mekaniske dokumentations-tabeller fra kodebase.
#  Kører via GitHub Actions ved hver push til main.
#  
#  Output: docs/auto/file-stats.md (overwrites ved hver kørsel)
#  
#  Princip: Kun objektivt udtrukket data fra kode.
#  Aldrig fortolkninger. Aldrig antagelser.
# ══════════════════════════════════════════════════════════════════════

set -e

ROOT_DIR="${1:-.}"
OUT="docs/auto/file-stats.md"

cd "$ROOT_DIR"
mkdir -p "$(dirname "$OUT")"

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# ──────────────────────────────────────────────────────────────
#  Header
# ──────────────────────────────────────────────────────────────
cat > "$OUT" << EOF
# Bubble — Auto-generated File Stats

> **AUTO-GENERATED** · Do not edit manually.  
> Generated: $TIMESTAMP · Commit: \`$COMMIT\` · Branch: \`$BRANCH\`  
> Generator: \`scripts/extract-arch-stats.sh\`

This document is mechanically extracted from the codebase on every push.
It contains only objectively verifiable data — no interpretations.

For semantic architecture documentation, see:
- \`ARCHITECTURE-MAP.md\` (foundation map, manually maintained)
- \`ARCHITECTURE-LOG.md\` (architecture decisions, manually maintained)
- \`STRATEGI.md\` (product strategy, manually maintained)

---

## 1. File Inventory

EOF

# ──────────────────────────────────────────────────────────────
#  Section 1: File Inventory
# ──────────────────────────────────────────────────────────────
echo "### 1.1 Production (root)" >> "$OUT"
echo "" >> "$OUT"
echo "| File | Lines | Size (bytes) | Last modified |" >> "$OUT"
echo "|---|---:|---:|---|" >> "$OUT"

for f in $(ls *.js *.html *.css *.json *.md 2>/dev/null | sort); do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f" | tr -d ' ')
    size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo "0")
    modified=$(git log -1 --format=%cd --date=short -- "$f" 2>/dev/null || echo "unknown")
    echo "| \`$f\` | $lines | $size | $modified |" >> "$OUT"
  fi
done

echo "" >> "$OUT"
echo "### 1.2 Next branch (next/)" >> "$OUT"
echo "" >> "$OUT"
echo "| File | Lines | Size (bytes) | Last modified |" >> "$OUT"
echo "|---|---:|---:|---|" >> "$OUT"

for f in $(ls next/*.js next/*.html next/*.css next/*.json next/*.md 2>/dev/null | sort); do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f" | tr -d ' ')
    size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo "0")
    modified=$(git log -1 --format=%cd --date=short -- "$f" 2>/dev/null || echo "unknown")
    echo "| \`$f\` | $lines | $size | $modified |" >> "$OUT"
  fi
done

# Total counts
PROD_JS_LINES=$(wc -l *.js 2>/dev/null | tail -1 | awk '{print $1}')
NEXT_JS_LINES=$(wc -l next/*.js 2>/dev/null | tail -1 | awk '{print $1}')

echo "" >> "$OUT"
echo "### 1.3 Totals" >> "$OUT"
echo "" >> "$OUT"
echo "| Metric | Value |" >> "$OUT"
echo "|---|---:|" >> "$OUT"
echo "| Prod JS lines | $PROD_JS_LINES |" >> "$OUT"
echo "| Next JS lines | $NEXT_JS_LINES |" >> "$OUT"

# ──────────────────────────────────────────────────────────────
#  Section 2: Function Counts
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 2. Function Counts per File

Detected via: `^function ` and `^async function ` declarations at top level.

### 2.1 Production

| File | Functions |
|---|---:|
EOF

for f in $(ls *.js 2>/dev/null | sort); do
  count=$(grep -c "^function \|^async function " "$f" 2>/dev/null || echo "0")
  echo "| \`$f\` | $count |" >> "$OUT"
done

# ──────────────────────────────────────────────────────────────
#  Section 3: Script Load Order
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 3. Script Load Order

From `index.html` script tags (production):

```
EOF

grep -oE 'src="[^"]*\.js[^"]*"' index.html 2>/dev/null | sed 's/src="//; s/"//' >> "$OUT" || true

echo "\`\`\`" >> "$OUT"

# ──────────────────────────────────────────────────────────────
#  Section 4: Supabase Table References
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 4. Supabase Table References

Tables referenced in code via `.from('table_name')`:

| Table | Files using |
|---|---|
EOF

# Extract unique table names
TABLES=$(grep -hoE "\.from\(['\"][a-z_]+['\"]\)" *.js 2>/dev/null | sed -E "s/\.from\(['\"]//; s/['\"]\)//" | sort -u)

for table in $TABLES; do
  files=$(grep -l "\.from(['\"]$table['\"])" *.js 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
  echo "| \`$table\` | $files |" >> "$OUT"
done

# ──────────────────────────────────────────────────────────────
#  Section 5: localStorage / sessionStorage Keys
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 5. Browser Storage Keys

### 5.1 localStorage keys

EOF

echo "Detected via \`localStorage.setItem\` / \`localStorage.getItem\` calls:" >> "$OUT"
echo "" >> "$OUT"
echo '```' >> "$OUT"
grep -hoE "localStorage\.(set|get)Item\(['\"][a-zA-Z_]+['\"]" *.js 2>/dev/null | \
  sed -E "s/localStorage\.(set|get)Item\(['\"]//; s/['\"]//" | sort -u >> "$OUT" || true
echo '```' >> "$OUT"

cat >> "$OUT" << 'EOF'

### 5.2 sessionStorage keys

EOF
echo "Detected via \`sessionStorage.setItem\` / \`sessionStorage.getItem\` calls:" >> "$OUT"
echo "" >> "$OUT"
echo '```' >> "$OUT"
grep -hoE "sessionStorage\.(set|get)Item\(['\"][a-zA-Z_]+['\"]" *.js 2>/dev/null | \
  sed -E "s/sessionStorage\.(set|get)Item\(['\"]//; s/['\"]//" | sort -u >> "$OUT" || true
echo '```' >> "$OUT"

# ──────────────────────────────────────────────────────────────
#  Section 6: Realtime Channels
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 6. Realtime Channels

Channels created via `sb.channel(...)`:

```
EOF

grep -hoE "sb\.channel\(['\"][^'\"]+" *.js 2>/dev/null | \
  sed -E "s/sb\.channel\(['\"]//; s/' \+.*//; s/\" \+.*//" | sort -u >> "$OUT" || true

echo '```' >> "$OUT"

# ──────────────────────────────────────────────────────────────
#  Section 7: Direct Supabase Writes
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 7. Direct Database Writes

Calls to `.insert()`, `.update()`, `.upsert()`, `.delete()` per file.

These should ideally go through `dbActions` write-layer.
Files with high counts are migration candidates.

| File | insert | update | upsert | delete | Total |
|---|---:|---:|---:|---:|---:|
EOF

for f in *.js; do
  [ -f "$f" ] || continue
  ins=$(grep -c "\.insert(" "$f" 2>/dev/null) || ins=0
  upd=$(grep -c "\.update(" "$f" 2>/dev/null) || upd=0
  ups=$(grep -c "\.upsert(" "$f" 2>/dev/null) || ups=0
  del=$(grep -c "\.delete(" "$f" 2>/dev/null) || del=0
  total=$((ins + upd + ups + del))
  if [ "$total" -gt 0 ]; then
    echo "| \`$f\` | $ins | $upd | $ups | $del | $total |" >> "$OUT"
  fi
done

# ──────────────────────────────────────────────────────────────
#  Section 8: Edge Function Calls
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 8. Edge Function Calls

Edge functions invoked from frontend code:

EOF

echo '```' >> "$OUT"
{
  grep -hoE "/functions/v1/[a-z-]+" *.js 2>/dev/null | sort -u
  grep -hoE "sb\.functions\.invoke\(['\"][a-z-]+['\"]" *.js 2>/dev/null | \
    sed -E "s/sb\.functions\.invoke\(['\"]//; s/['\"]//"
} | sort -u >> "$OUT" || true
echo '```' >> "$OUT"

# ──────────────────────────────────────────────────────────────
#  Section 9: Cross-file Dependency (Top callees)
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 9. Foundation Function Usage (Top Callees)

How many files call each foundation function:

| Function | Files using |
|---|---:|
EOF

for fn in "logError" "showToast" "escHtml" "goTo" "appMode\." "navState\." "flowGet" "flowSet" "consumeFlow" "isUuid" "registerState" "resetAppState" "dbActions\." "t(" "translateStaticUI"; do
  count=$(grep -l "$fn" *.js 2>/dev/null | grep -v "^b-config.js$\|^b-utils.js$\|^b-i18n.js$\|^b-navigation.js$" | wc -l | tr -d ' ')
  display=$(echo "$fn" | sed 's/\\\././g; s/\$//')
  echo "| \`$display\` | $count |" >> "$OUT"
done

# ──────────────────────────────────────────────────────────────
#  Section 10: TODO / FIXME / HACK Comments
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 10. TODO / FIXME / HACK Comments

Tracking technical debt comments in codebase:

EOF

TODO_TOTAL=0
for tag in "TODO" "FIXME" "HACK" "XXX"; do
  count=$(grep -rh "$tag" *.js 2>/dev/null | wc -l) || count=0
  TODO_TOTAL=$((TODO_TOTAL + count))
done
echo "**Total: $TODO_TOTAL comments**" >> "$OUT"
echo "" >> "$OUT"
echo "| Type | Count |" >> "$OUT"
echo "|---|---:|" >> "$OUT"
for tag in "TODO" "FIXME" "HACK" "XXX"; do
  count=$(grep -rh "$tag" *.js 2>/dev/null | wc -l) || count=0
  echo "| $tag | $count |" >> "$OUT"
done

# ──────────────────────────────────────────────────────────────
#  Footer
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << EOF

---

## Generation Info

- Script: \`scripts/extract-arch-stats.sh\`
- Workflow: \`.github/workflows/arch-stats.yml\`
- Generated: $TIMESTAMP
- Commit: \`$COMMIT\`
- Branch: \`$BRANCH\`

To regenerate locally:
\`\`\`bash
bash scripts/extract-arch-stats.sh
\`\`\`

To extend this script, add a new section in \`scripts/extract-arch-stats.sh\`
and follow the existing pattern. Keep all extractions **mechanical** — no
human interpretations or assumptions.
EOF

echo "✓ Generated $OUT"
echo "  Lines: $(wc -l < "$OUT")"
