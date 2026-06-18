#!/usr/bin/env bash
# Selvstaendig: spinder en engangs-postgres op, loader schema, koerer RLS-test, river ned.
set -euo pipefail
PG=/usr/lib/postgresql/16/bin
PORT=7755
DIR="$(cd "$(dirname "$0")" && pwd)"
STAGE=$(mktemp -d); DATA="$STAGE/data"
RUNAS=""; [ "$(id -u)" = "0" ] && RUNAS="su postgres -s /bin/bash -c" && chown -R postgres "$STAGE"
run(){ if [ -n "$RUNAS" ]; then $RUNAS "$*"; else bash -c "$*"; fi; }
cleanup(){ run "$PG/pg_ctl -D $DATA -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$STAGE"; }
trap cleanup EXIT
run "$PG/initdb -D $DATA" >/dev/null 2>&1
run "$PG/pg_ctl -D $DATA -l $DATA/log -o '-p $PORT' start" >/dev/null 2>&1
sleep 2
run "$PG/createdb -p $PORT d"
cp "$DIR/bubble-message-edits.schema.sql" "$DIR/bubble-message-edits.test.sql" "$STAGE/"
[ -n "$RUNAS" ] && chown postgres "$STAGE"/*.sql
run "$PG/psql -p $PORT -d d -v ON_ERROR_STOP=1 -q -f $STAGE/bubble-message-edits.schema.sql" >/dev/null
echo "── Koerer bubble_message_edits RLS-test (som rollen 'authenticated', ikke superuser) ──"
run "$PG/psql -p $PORT -d d -v ON_ERROR_STOP=1 -f $STAGE/bubble-message-edits.test.sql" 2>&1 | grep -E 'PASS|FAIL|ASSERTIONS|ERROR'
