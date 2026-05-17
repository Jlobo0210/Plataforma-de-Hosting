import os

class NginxManager:
    def __init__(self):
        self.config_path = os.getenv("NGINX_CONFIG_PATH", "/nginx_locations")
        self.enabled = os.path.exists(self.config_path)
        
        if not self.enabled:
            print("⚠️  [NginxManager] Carpeta no encontrada, rutas no se escribirán")
        else:
            print(f"✅ [NginxManager] Usando carpeta: {self.config_path}")

    def add_route(self, service_id: str, container_name: str, endpoint: str):
        if not self.enabled:
            print(f"[DEV] Ruta ignorada: /api/services/{endpoint}")
            return

        nginx_dollar = "$"

        config_content = (
        f"location ~ ^/api/services/{endpoint}(/.*)?{nginx_dollar} {{\n"
        f"    resolver 127.0.0.11 valid=5s;\n"
        f"    set {nginx_dollar}upstream http://{container_name}:8080;\n"
        # Captura todo lo que viene después del endpoint
        f"    set {nginx_dollar}path {nginx_dollar}1;\n"
        # Si no hay nada después, usar /
        f"    if ({nginx_dollar}path = '') {{\n"
        f"        set {nginx_dollar}path /;\n"
        f"    }}\n"
        # proxy_pass con la variable de path, sin rewrite
        f"    proxy_pass {nginx_dollar}upstream{nginx_dollar}path{nginx_dollar}is_args{nginx_dollar}args;\n"
        f"    proxy_set_header Host {nginx_dollar}host;\n"
        f"    proxy_set_header X-Real-IP {nginx_dollar}remote_addr;\n"
        f"    proxy_set_header Content-Type {nginx_dollar}content_type;\n"
        f"    proxy_set_header Content-Length {nginx_dollar}content_length;\n"
        f"    proxy_pass_request_body on;\n"
        f"    proxy_connect_timeout 30s;\n"
        f"    proxy_read_timeout 60s;\n"
        f"}}\n"
    )


        config_file = os.path.join(self.config_path, f"ms_{service_id}.conf")
        with open(config_file, 'w') as f:
            f.write(config_content)
        
        print(f"✅ [NginxManager] Ruta creada: /api/services/{endpoint}")

    def remove_route(self, service_id: str):
        if not self.enabled:
            return

        config_file = os.path.join(self.config_path, f"ms_{service_id}.conf")
        if os.path.exists(config_file):
            os.remove(config_file)
            print(f"🗑️  [NginxManager] Ruta eliminada: {service_id}")

    def cleanup_all(self):
        if not self.enabled:
            return

        for file in os.listdir(self.config_path):
            if file.startswith("ms_") and file.endswith(".conf"):
                os.remove(os.path.join(self.config_path, file))
        
        print("🗑️  [NginxManager] Todas las rutas eliminadas")