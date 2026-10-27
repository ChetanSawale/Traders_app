#!/bin/sh
# Render / Docker Compose: fill the backend host+port into nginx config at container start.
# Defaults keep local Docker Compose working (backend:3001).
set -e
BACKEND_HOST="${BACKEND_HOST:-backend}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
BACKEND_RESOLVER="${BACKEND_RESOLVER:-127.0.0.11}"
sed -e "s|\${BACKEND_HOST}|${BACKEND_HOST}|g" -e "s|\${BACKEND_PORT}|${BACKEND_PORT}|g" -e "s|\${BACKEND_RESOLVER}|${BACKEND_RESOLVER}|g" \
  /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
