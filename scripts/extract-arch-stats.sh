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

## 📜 Rule for this document

> **This file contains only mechanically extractable facts.**  
> **If a section requires interpretation, it belongs in \`ARCHITECTURE-MAP.md\` instead.**

This document is mechanically extracted from the codebase on every push.
It contains only objectively verifiable data — no interpretations, no
assumptions, no semantic analysis.

For semantic architecture documentation, see:
- \`ARCHITECTURE-MAP.md\` (foundation map, manually maintained)
- \`ARCHITECTURE-LOG.md\` (architecture decisions, manually maintained)
- \`STRATEGI.md\` (product strategy, manually maintained)
- \`OPEN-QUESTIONS.md\` (open arch questions, manually maintained)

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
#  Section 11: RPC Calls
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 11. RPC Calls

Postgres RPC functions invoked via `sb.rpc('function_name')`:

| RPC Function | Files using |
|---|---|
EOF

# Extract unique RPC function names
RPCS=$(grep -hoE "\.rpc\(['\"][a-zA-Z_]+['\"]" *.js 2>/dev/null | sed -E "s/\.rpc\(['\"]//; s/['\"]//" | sort -u)

if [ -z "$RPCS" ]; then
  echo "| _(none detected)_ | — |" >> "$OUT"
else
  while IFS= read -r rpc; do
    [ -z "$rpc" ] && continue
    files=$(grep -l "\.rpc(['\"]$rpc['\"]" *.js 2>/dev/null | tr '\n' ',' | sed 's/,$//; s/,/, /g')
    [ -z "$files" ] && files="_—_"
    echo "| \`$rpc\` | $files |" >> "$OUT"
  done <<< "$RPCS"
fi

# ──────────────────────────────────────────────────────────────
#  Section 12: Storage Usage
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 12. Storage Usage

Supabase Storage buckets accessed via `sb.storage.from('bucket')`:

### 12.1 Buckets used

| Bucket | Files using |
|---|---|
EOF

BUCKETS=$(grep -hoE "\.storage\.from\(['\"][a-zA-Z_-]+['\"]" *.js 2>/dev/null | sed -E "s/\.storage\.from\(['\"]//; s/['\"]//" | sort -u)

if [ -z "$BUCKETS" ]; then
  echo "| _(none detected)_ | — |" >> "$OUT"
else
  for bucket in $BUCKETS; do
    files=$(grep -l "\.storage\.from(['\"]$bucket['\"])" *.js 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
    echo "| \`$bucket\` | $files |" >> "$OUT"
  done
fi

cat >> "$OUT" << 'EOF'

### 12.2 Storage operations per file

Only counts methods called **on storage buckets** (e.g.,
`sb.storage.from(...).upload()`). Excludes generic `.remove()`
on arrays/elements.

| File | upload | download | createSignedUrl | getPublicUrl |
|---|---:|---:|---:|---:|
EOF

for f in *.js; do
  [ -f "$f" ] || continue
  # Count storage operations - look for patterns near .storage.from
  upload=$(grep -E "\.storage\.from\([^)]+\)" "$f" 2>/dev/null | grep -c "\.upload(" 2>/dev/null) || upload=0
  # Easier: count .upload( in files that use storage (false positives possible but lower)
  if ! grep -q "\.storage\." "$f" 2>/dev/null; then
    upload=0
  else
    # Count upload near storage usage
    upload=$(grep -A 3 "\.storage\.from" "$f" 2>/dev/null | grep -c "\.upload(") || upload=0
    download=$(grep -A 3 "\.storage\.from" "$f" 2>/dev/null | grep -c "\.download(") || download=0
    signed=$(grep -c "createSignedUrl" "$f" 2>/dev/null) || signed=0
    publicUrl=$(grep -c "getPublicUrl" "$f" 2>/dev/null) || publicUrl=0
  fi
  
  if grep -q "\.storage\." "$f" 2>/dev/null; then
    download=$(grep -A 3 "\.storage\.from" "$f" 2>/dev/null | grep -c "\.download(") || download=0
    signed=$(grep -c "createSignedUrl" "$f" 2>/dev/null) || signed=0
    publicUrl=$(grep -c "getPublicUrl" "$f" 2>/dev/null) || publicUrl=0
    
    total=$((upload + download + signed + publicUrl))
    if [ "$total" -gt 0 ]; then
      echo "| \`$f\` | $upload | $download | $signed | $publicUrl |" >> "$OUT"
    fi
  fi
done

# ──────────────────────────────────────────────────────────────
#  Section 13: Auth Mutations
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 13. Auth Mutations

State-changing auth calls (`sb.auth.X(...)`). Read-only calls like
`getUser()` and `getSession()` are excluded — only mutations.

| Auth method | Files using |
|---|---|
EOF

# Mutating auth methods we care about
AUTH_METHODS="signInWithPassword signUp signOut signInWithOAuth signInWithOtp resetPasswordForEmail updateUser refreshSession setSession verifyOtp"

for method in $AUTH_METHODS; do
  files=$(grep -l "auth\.$method(" *.js 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
  if [ -n "$files" ]; then
    echo "| \`$method\` | $files |" >> "$OUT"
  fi
done

cat >> "$OUT" << 'EOF'

### 13.1 onAuthStateChange listeners

Files registering auth state change listeners:

EOF

echo '```' >> "$OUT"
grep -l "onAuthStateChange" *.js 2>/dev/null >> "$OUT" || echo "_(none)_" >> "$OUT"
echo '```' >> "$OUT"

# ──────────────────────────────────────────────────────────────
#  Section 14: DOM Event Contracts
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 14. DOM Event Contracts

Inline HTML event handlers. These are implicit contracts between HTML and JS —
if the JS function is renamed, the HTML breaks silently.

For native (React Native), every inline handler must be replaced with a
prop-based handler (`onPress={...}`).

### 14.1 Inline event handlers in index.html

| Event type | Count |
|---|---:|
EOF

EVENTS="onclick onchange onsubmit onkeydown oninput onfocus onblur ondblclick onmouseover onmouseout"

for event in $EVENTS; do
  count=$(grep -c "$event=\"" index.html 2>/dev/null) || count=0
  if [ "$count" -gt 0 ]; then
    echo "| \`$event=\"...\"\` | $count |" >> "$OUT"
  fi
done

cat >> "$OUT" << 'EOF'

### 14.2 Inline event handlers in landing.html

| Event type | Count |
|---|---:|
EOF

for event in $EVENTS; do
  count=$(grep -c "$event=\"" landing.html 2>/dev/null) || count=0
  if [ "$count" -gt 0 ]; then
    echo "| \`$event=\"...\"\` | $count |" >> "$OUT"
  fi
done

cat >> "$OUT" << 'EOF'

### 14.3 Top function names called from inline onclick

(Only names with `()` immediately after — most reliable)

| Function | Calls in HTML |
|---|---:|
EOF

# Extract function names from inline onclick — pattern: onclick="funcName(
ONCLICK_FNS=$(grep -hoE 'onclick="[a-zA-Z_]+\(' index.html landing.html 2>/dev/null | \
  sed -E 's/onclick="//; s/\($//' | sort | uniq -c | sort -rn | head -20)

if [ -z "$ONCLICK_FNS" ]; then
  echo "| _(none detected)_ | — |" >> "$OUT"
else
  echo "$ONCLICK_FNS" | while read count fn; do
    echo "| \`$fn()\` | $count |" >> "$OUT"
  done
fi

# ──────────────────────────────────────────────────────────────
#  Section 15: Per-Table Write Locations
# ──────────────────────────────────────────────────────────────
cat >> "$OUT" << 'EOF'

---

## 15. Per-Table Write Locations

For each Supabase table, which files perform writes (insert/update/upsert/delete).

This is the most important section for native rewrite — it shows where
business logic for each entity lives. Tables written from many files are
candidates for **service-layer extraction** (e.g., `ProfileService`,
`BubbleService`).

| Table | Insert | Update | Upsert | Delete | Write-spread |
|---|---|---|---|---|---:|
EOF

# Get unique table names
TABLES=$(grep -hoE "\.from\(['\"][a-z_]+['\"]\)" *.js 2>/dev/null | sed -E "s/\.from\(['\"]//; s/['\"]\)//" | sort -u)

# For each table, check which files call which write operations
for table in $TABLES; do
  insert_files=""
  update_files=""
  upsert_files=""
  delete_files=""
  
  for f in *.js; do
    [ -f "$f" ] || continue
    
    # Check if this file uses this table
    if grep -q "\.from(['\"]$table['\"])" "$f" 2>/dev/null; then
      # Check what kind of writes (using awk to look for table.from + write within reasonable distance)
      # Simpler approach: if file has both .from('table') and .insert/.update/etc, count it
      
      # Count writes near the table reference using awk
      ins=$(awk -v tbl="$table" '
        /\.from\([\x27\x22]/ { 
          if (index($0, tbl)) in_table=1; else in_table=0
        }
        in_table && /\.insert\(/ { count++; in_table=0 }
        END { print count+0 }
      ' "$f" 2>/dev/null) || ins=0
      
      upd=$(awk -v tbl="$table" '
        /\.from\([\x27\x22]/ { 
          if (index($0, tbl)) in_table=1; else in_table=0
        }
        in_table && /\.update\(/ { count++; in_table=0 }
        END { print count+0 }
      ' "$f" 2>/dev/null) || upd=0
      
      ups=$(awk -v tbl="$table" '
        /\.from\([\x27\x22]/ { 
          if (index($0, tbl)) in_table=1; else in_table=0
        }
        in_table && /\.upsert\(/ { count++; in_table=0 }
        END { print count+0 }
      ' "$f" 2>/dev/null) || ups=0
      
      del=$(awk -v tbl="$table" '
        /\.from\([\x27\x22]/ { 
          if (index($0, tbl)) in_table=1; else in_table=0
        }
        in_table && /\.delete\(/ { count++; in_table=0 }
        END { print count+0 }
      ' "$f" 2>/dev/null) || del=0
      
      if [ "$ins" -gt 0 ]; then insert_files="$insert_files $f"; fi
      if [ "$upd" -gt 0 ]; then update_files="$update_files $f"; fi
      if [ "$ups" -gt 0 ]; then upsert_files="$upsert_files $f"; fi
      if [ "$del" -gt 0 ]; then delete_files="$delete_files $f"; fi
    fi
  done
  
  # Format file lists (trim, uniq, comma-separate)
  insert_files=$(echo $insert_files | tr ' ' '\n' | sort -u | tr '\n' ',' | sed 's/,$//; s/,/, /g')
  update_files=$(echo $update_files | tr ' ' '\n' | sort -u | tr '\n' ',' | sed 's/,$//; s/,/, /g')
  upsert_files=$(echo $upsert_files | tr ' ' '\n' | sort -u | tr '\n' ',' | sed 's/,$//; s/,/, /g')
  delete_files=$(echo $delete_files | tr ' ' '\n' | sort -u | tr '\n' ',' | sed 's/,$//; s/,/, /g')
  
  # Calculate spread (how many unique files write to this table)
  all_writers=$(echo "$insert_files $update_files $upsert_files $delete_files" | tr ' ,' '\n\n' | grep -v '^$' | sort -u | wc -l | tr -d ' ')
  
  # Only show tables with at least one write
  if [ -n "$insert_files$update_files$upsert_files$delete_files" ]; then
    # Use _(none)_ if empty
    [ -z "$insert_files" ] && insert_files="_—_"
    [ -z "$update_files" ] && update_files="_—_"
    [ -z "$upsert_files" ] && upsert_files="_—_"
    [ -z "$delete_files" ] && delete_files="_—_"
    
    echo "| \`$table\` | $insert_files | $update_files | $upsert_files | $delete_files | $all_writers |" >> "$OUT"
  fi
done

cat >> "$OUT" << 'EOF'

**Migration priority:** Tables with high write-spread (4+ files) are
top candidates for service-layer extraction in native rewrite.

EOF

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
