#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Logic test for gdpr_delete_user against a faithful local Postgres replica.
#
# Spins up a throwaway Postgres cluster, loads a replica of the verified Bubble
# schema (schema.sql) + the real migration + a full delete scenario
# (gdpr-delete.test.sql), asserts everything, then tears the cluster down.
#
# Validates FUNCTION LOGIC (anonymize/delete/FK-order/cascade/storage/no-over-
# reach) — does NOT touch any live database. Run after changing
# migrations/2026-06_gdpr-delete-user.sql.
#
# Requires Postgres:  apt-get install -y postgresql   (or brew install postgresql)
# Run:                bash tests/db/run-gdpr-delete-test.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../../migrations/2026-06_gdpr-delete-user.sql"

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$PGBIN" ]; then PGP="$PGBIN/"; export PATH="$PGBIN:$PATH"; else PGP=""; fi
command -v "${PGP}initdb" >/dev/null 2>&1 || { echo "SKIP: postgres ikke fundet (apt-get install postgresql)"; exit 2; }

DATA="$(mktemp -d)"      # cluster dir — MUST stay empty until initdb
STAGE="$(mktemp -d)"     # SQL staging — readable by the runtime user
PORT=$(( (RANDOM % 2000) + 5500 ))

# postgres refuses to run as root → use the postgres OS user when we are root
RUN() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$1"; else bash -c "$1"; fi; }

cp "$HERE/schema.sql" "$HERE/gdpr-delete.test.sql" "$MIG" "$STAGE/"
MIGNAME="$(basename "$MIG")"
[ "$(id -u)" = "0" ] && chown -R postgres "$DATA" "$STAGE"

cleanup() { RUN "${PGP}pg_ctl -D '$DATA' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATA" "$STAGE"; }
trap cleanup EXIT

RUN "${PGP}initdb -D '$DATA'" >/dev/null 2>&1
RUN "${PGP}pg_ctl -D '$DATA' -l '$DATA/log' -o '-p $PORT' start" >/dev/null 2>&1
sleep 2
RUN "${PGP}createdb -p $PORT bubbletest"

RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/schema.sql'" >/dev/null
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/$MIGNAME'" >/dev/null
echo "── gdpr_delete_user logic test ──"
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/gdpr-delete.test.sql'"
echo "── gdpr-delete: PASS ──"
