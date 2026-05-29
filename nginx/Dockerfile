FROM nginx:alpine

RUN apk add --no-cache inotify-tools

# Carpeta para configuraciones dinámicas de proyectos.
# El backend escribe aquí archivos project_*.conf (server blocks completos
# para subdominios proyecto.usuario.localhost). reload_watch.sh detecta
# cambios y recarga NGINX sin reinicio.
RUN mkdir -p /etc/nginx/locations

COPY nginx.conf /etc/nginx/nginx.conf
COPY reload_watch.sh /reload_watch.sh
RUN sed -i 's/\r//' /reload_watch.sh && chmod +x /reload_watch.sh

# Healthcheck para saber si NGINX está listo
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1/nginx-health || exit 1

CMD ["/bin/sh", "-c", "nginx && /reload_watch.sh"]