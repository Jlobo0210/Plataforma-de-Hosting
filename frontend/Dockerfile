# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder        

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

RUN npm run build

# ── Stage 2: Production con NGINX ─────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html

RUN echo 'server { \
    listen 3000; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]