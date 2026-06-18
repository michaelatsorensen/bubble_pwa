#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# RLS privacy test: loads a replica with the REAL production policies and runs
# reads AS the `authenticated` role (not superuser) to prove what a non-
# participant can actually read across tenants. Documents the target secure
# state — it FAILS while a cross-user read is possible, passes once tightened.
#
# Requires Postgres:  apt-get install -y postgresql
# Run:                bash tests/db/run-rls-test.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$PGBIN" ]; then PGP="$PGBIN/"; export PATH="$PGBIN:$PATH"; else PGP=""; fi
command -v "${PGP}initdb" >/dev/null 2>&1 || { echo "SKIP: postgres ikke fundet (apt-get install postgresql)"; exit 2; }
DATA="$(mktemp -d)"; STAGE="$(mktemp -d)"; PORT=$(( (RANDOM % 2000) + 5500 ))
RUN() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$1"; else bash -c "$1"; fi; }
cp "$HERE/rls.schema.sql" "$HERE/rls.test.sql" "$STAGE/"
[ "$(id -u)" = "0" ] && chown -R postgres "$DATA" "$STAGE"
cleanup() { RUN "${PGP}pg_ctl -D '$DATA' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATA" "$STAGE"; }
trap cleanup EXIT
RUN "${PGP}initdb -D '$DATA'" >/dev/null 2>&1
RUN "${PGP}pg_ctl -D '$DATA' -l '$DATA/log' -o '-p $PORT' start" >/dev/null 2>&1
sleep 2
RUN "${PGP}createdb -p $PORT bubbletest"
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/rls.schema.sql'" >/dev/null
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/rls.test.sql'"
