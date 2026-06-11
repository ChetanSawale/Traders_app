#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
DB_CONTAINER="tradesphere-postgres"
DB_USER="postgres"
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tradesphere_backup_$DATE.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting PostgreSQL backup for container $DB_CONTAINER..."

# Run dumpall inside docker container and compress
if docker exec -t "$DB_CONTAINER" pg_dumpall -U "$DB_USER" | gzip > "$BACKUP_FILE"; then
    echo "Backup completed successfully: $BACKUP_FILE"
else
    echo "Error: Database backup failed!" >&2
    exit 1
fi

# Keep only last 7 days of backups
echo "Pruning backups older than 7 days..."
find "$BACKUP_DIR" -name "tradesphere_backup_*.sql.gz" -mtime +7 -delete

echo "Backup maintenance cycle finished."
