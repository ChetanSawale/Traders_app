# --- Build Stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# --- Serve Stage ---
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Templated nginx config: backend host/port are filled in at container start
# by docker-entrypoint.sh (Render: trader-backend:10000, Compose: backend:3001).
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
