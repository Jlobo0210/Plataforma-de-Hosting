#!/bin/sh

echo "👀 Watching for changes in /etc/nginx/locations/ (project_*.conf)..."

while true; do
    # Cualquier cambio en la carpeta de configs dinámicas dispara un reload.
    inotifywait -e modify,create,delete /etc/nginx/locations/ 2>/dev/null
    echo "🔄 Change detected, reloading NGINX..."
    nginx -s reload
done