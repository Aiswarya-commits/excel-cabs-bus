#!/bin/sh
# Daily DB backup (cron: 30 2 * * * /opt/excel-bus/deploy/backup.sh). Keeps 14 days.
set -e
DIR=/var/backups/excel-bus; mkdir -p $DIR
docker compose -f /opt/excel-bus/docker-compose.yml exec -T db pg_dump -U excel -Fc excel_bus > $DIR/excel_bus_$(date +%F).dump
find $DIR -name '*.dump' -mtime +14 -delete
# Restore: docker compose exec -T db pg_restore -U excel -d excel_bus --clean < file.dump
