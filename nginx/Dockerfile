FROM nginx:alpine

RUN apk add --no-cache inotify-tools

# Crear carpeta para locations dinámicas
RUN mkdir -p /etc/nginx/locations

COPY nginx.conf /etc/nginx/nginx.conf
COPY reload_watch.sh /reload_watch.sh
RUN sed -i 's/\r//' /reload_watch.sh && chmod +x /reload_watch.sh

# Healthcheck para saber si NGINX está listo
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost/api/services || exit 1

CMD ["/bin/sh", "-c", "nginx && /reload_watch.sh"]