#!/bin/sh
set -e

echo "Running entrypoint: ensure Prisma client generated and run migrations (if DB available)"

if command -v npx >/dev/null 2>&1; then
  echo "Generating Prisma client..."
  npx prisma generate || true

  echo "Attempting to run migrations (may fail if DB not ready). Retrying a few times..."
    # simple retry loop for migrations to wait for DB readiness
    # Increase retries and sleep to tolerate slower DB startups.
    MAX_RETRIES=30
    SLEEP_SEC=3
    i=0
    MIGRATE_SUCCEEDED=0

    echo "DATABASE_URL=${DATABASE_URL:-<not set>}"

    until [ "$i" -ge "$MAX_RETRIES" ]
    do
      echo "migrate attempt: $((i+1))"
      # Capture output to inspect specific Prisma errors
      if npx prisma migrate deploy 2>&1 | tee /tmp/prisma_migrate.log; then
        echo "migrate deploy succeeded"
        MIGRATE_SUCCEEDED=1
        break
      else
        MIGRATE_LOG=$(cat /tmp/prisma_migrate.log || true)
        echo "migrate failed, log:"
        echo "$MIGRATE_LOG"
        # If the DB is non-empty and no migrations exist, Prisma returns P3005.
        # In that case, skip further migrate attempts to avoid infinite retry.
        echo "$MIGRATE_LOG" | grep -q "P3005" && {
          echo "Detected P3005 (database not empty with no migrations). Skipping migrate deploy.";
          MIGRATE_SUCCEEDED=1
          break
        }
        i=$((i+1))
        echo "migrate failed, sleeping ${SLEEP_SEC}s before retry"
        sleep ${SLEEP_SEC}
      fi
    done

    if [ "$MIGRATE_SUCCEEDED" -ne 1 ]; then
      echo "ERROR: migrations did not succeed after ${MAX_RETRIES} attempts. See /tmp/prisma_migrate.log for details. Aborting startup."
      cat /tmp/prisma_migrate.log || true
      exit 1
    fi
else
  echo "npx not available in container; skipping prisma generate/migrate"
fi

echo "Starting app"
exec "$@"
