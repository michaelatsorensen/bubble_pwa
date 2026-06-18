#!/usr/bin/env bash
# Logic test for bubble_members INSERT authorization: proves a normal user cannot
# self-insert as admin. Models the real INSERT policies + the role guard, runs as
# the authenticated role. RED against the current guard (BEFORE UPDATE only);
# goes green once the guard also fires on INSERT (see member-role-insert-guard migration).
# Requires Postgres. Run: bash tests/db/run-role-insert-test.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$PGBIN" ]; then PGP="$PGBIN/"; export PATH="$PGBIN:$PATH"; else PGP=""; fi
command -v "${PGP}initdb" >/dev/null 2>&1 || { echo "SKIP: postgres ikke fundet"; exit 2; }
DATA="$(mktemp -d)"; STAGE="$(mktemp -d)"; PORT=$(( (RANDOM % 2000) + 5500 ))
RUN() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$1"; else bash -c "$1"; fi; }
cp "$HERE/role-insert.schema.sql" "$HERE/role-insert.test.sql" "$STAGE/"
[ "$(id -u)" = "0" ] && chown -R postgres "$DATA" "$STAGE"
cleanup() { RUN "${PGP}pg_ctl -D '$DATA' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATA" "$STAGE"; }
trap cleanup EXIT
RUN "${PGP}initdb -D '$DATA'" >/dev/null 2>&1
RUN "${PGP}pg_ctl -D '$DATA' -l '$DATA/log' -o '-p $PORT' start" >/dev/null 2>&1
sleep 2
RUN "${PGP}createdb -p $PORT bubbletest"
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/role-insert.schema.sql'" >/dev/null
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/role-insert.test.sql'"
