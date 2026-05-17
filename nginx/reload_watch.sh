#!/bin/sh

echo "👀 Watching for changes..."

while true; do
    # Vigila la nueva carpeta
    inotifywait -e modify,create,delete /etc/nginx/locations/ 2>/dev/null
    echo "🔄 Change detected, reloading NGINX..."
    nginx -s reload
done