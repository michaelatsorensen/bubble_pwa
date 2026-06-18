#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Logic test for the bubble_members role-escalation guard
# (prevent_member_role_escalation) against a faithful local Postgres replica.
#
# Spins up a throwaway cluster, loads role-guard.schema.sql (tables + the
# verbatim production trigger function + trigger) and role-escalation.test.sql
# (owner-can / non-owner-blocked scenarios), asserts, tears down.
#
# Validates the TRIGGER layer in isolation — does NOT touch any live database,
# and does NOT model RLS (a separate layer). Run after changing the guard.
#
# NOTE: firing condition CONFIRMED via pg_get_triggerdef: BEFORE UPDATE row-level.
#
# Requires Postgres:  apt-get install -y postgresql
# Run:                bash tests/db/run-role-escalation-test.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$PGBIN" ]; then PGP="$PGBIN/"; export PATH="$PGBIN:$PATH"; else PGP=""; fi
command -v "${PGP}initdb" >/dev/null 2>&1 || { echo "SKIP: postgres ikke fundet (apt-get install postgresql)"; exit 2; }

DATA="$(mktemp -d)"; STAGE="$(mktemp -d)"
PORT=$(( (RANDOM % 2000) + 5500 ))
RUN() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$1"; else bash -c "$1"; fi; }

cp "$HERE/role-guard.schema.sql" "$HERE/role-escalation.test.sql" "$STAGE/"
[ "$(id -u)" = "0" ] && chown -R postgres "$DATA" "$STAGE"

cleanup() { RUN "${PGP}pg_ctl -D '$DATA' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATA" "$STAGE"; }
trap cleanup EXIT

RUN "${PGP}initdb -D '$DATA'" >/dev/null 2>&1
RUN "${PGP}pg_ctl -D '$DATA' -l '$DATA/log' -o '-p $PORT' start" >/dev/null 2>&1
sleep 2
RUN "${PGP}createdb -p $PORT bubbletest"
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/role-guard.schema.sql'" >/dev/null
echo "── role-escalation guard logic test ──"
RUN "${PGP}psql -p $PORT -d bubbletest -v ON_ERROR_STOP=1 -f '$STAGE/role-escalation.test.sql'"
echo "── role-escalation: PASS ──"
