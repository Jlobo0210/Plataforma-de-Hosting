import os
import re


_SUBDOMAIN_RE = re.compile(r"[^a-z0-9-]")


def _sanitize_label(value: str) -> str:
    """Convierte un nombre a un label DNS válido (minúsculas, [a-z0-9-])."""
    cleaned = _SUBDOMAIN_RE.sub("-", value.strip().lower()).strip("-")
    if not cleaned:
        raise ValueError(f"Nombre inválido para subdominio: {value!r}")
    return cleaned


class NginxManager:
    """
    Gestiona los `server` blocks dinámicos de NGINX para cada proyecto
    de hosting. Cada proyecto se publica en
    http://{project_name}.{username}.localhost y se proxy-pasa al
    contenedor del usuario en el puerto que él indicó al crearlo.
    """

    def __init__(self):
        self.config_path = os.getenv("NGINX_CONFIG_PATH", "/nginx_locations")
        self.enabled = os.path.exists(self.config_path)

        if not self.enabled:
            print("⚠️  [NginxManager] Carpeta no encontrada, rutas no se escribirán")
        else:
            print(f"✅ [NginxManager] Usando carpeta: {self.config_path}")

    def add_project_route(
        self,
        project_id: str,
        project_name: str,
        username: str,
        container_name: str,
        port: int,
    ) -> str:
        """
        Crea un server block para http://{project_name}.{username}.localhost
        que hace proxy al contenedor del proyecto en el puerto indicado.

        Devuelve el hostname generado.
        """
        project_label = _sanitize_label(project_name)
        user_label = _sanitize_label(username)
        hostname = f"{project_label}.{user_label}.localhost"

        if not self.enabled:
            print(f"[DEV] Ruta ignorada: http://{hostname}")
            return hostname

        d = "$"
        config_content = (
            f"server {{\n"
            f"    listen 80;\n"
            f"    server_name {hostname};\n"
            f"\n"
            f"    # Rate limit: 60 req/min por IP (zona definida en nginx.conf)\n"
            f"    limit_req zone=hosting_ratelimit burst=10 nodelay;\n"
            f"\n"
            f"    location / {{\n"
            f"        resolver 127.0.0.11 valid=5s;\n"
            f"        set {d}upstream http://{container_name}:{port};\n"
            f"        proxy_pass {d}upstream;\n"
            f"        proxy_set_header Host {d}host;\n"
            f"        proxy_set_header X-Real-IP {d}remote_addr;\n"
            f"        proxy_set_header X-Forwarded-For {d}proxy_add_x_forwarded_for;\n"
            f"        proxy_set_header X-Forwarded-Proto {d}scheme;\n"
            f"        proxy_http_version 1.1;\n"
            f"        proxy_set_header Upgrade {d}http_upgrade;\n"
            f"        proxy_set_header Connection \"upgrade\";\n"
            f"        proxy_connect_timeout 30s;\n"
            f"        proxy_read_timeout 60s;\n"
            f"        proxy_send_timeout 60s;\n"
            f"    }}\n"
            f"}}\n"
        )

        config_file = os.path.join(self.config_path, f"project_{project_id}.conf")
        with open(config_file, "w") as f:
            f.write(config_content)

        print(f"✅ [NginxManager] Proyecto publicado: http://{hostname}")
        return hostname

    def remove_route(self, project_id: str) -> None:
        """Elimina el server block del proyecto."""
        if not self.enabled:
            return

        config_file = os.path.join(self.config_path, f"project_{project_id}.conf")
        if os.path.exists(config_file):
            os.remove(config_file)
            print(f"🗑️  [NginxManager] Proyecto despublicado: {project_id}")

    def cleanup_all(self) -> None:
        """Borra todos los server blocks dinámicos de proyectos."""
        if not self.enabled:
            return

        for file in os.listdir(self.config_path):
            if file.startswith("project_") and file.endswith(".conf"):
                os.remove(os.path.join(self.config_path, file))

        print("🗑️  [NginxManager] Todas las rutas eliminadas")
