import docker
import uuid
import os
import ast
import json
import time
import threading

class DockerManager:
    def __init__(self):
        self.client = docker.from_env()
        self.network_name = os.getenv("DOCKER_NETWORK", "platform_network")
        self.active_services = {}
        self.templates_dir = os.path.join(os.path.dirname(__file__), "templates")
        self._monitor_running = False  

        print("Construyendo imágenes base...")
        self._build_base_images()
        print("Imágenes base listas.")

        # Iniciar el monitor en segundo plano
        self._start_monitor()

    # ─────────────────────────────────────────────────────
    # Monitor de contenedores
    # ─────────────────────────────────────────────────────

    def _start_monitor(self):
        """Inicia el hilo monitor en segundo plano."""
        self._monitor_running = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True  
        )
        self._monitor_thread.start()
        print("👀 Monitor de contenedores iniciado")

    def _stop_monitor(self):
        """Detiene el hilo monitor."""
        self._monitor_running = False

    def _monitor_loop(self):
        """
        Revisa el estado real de los contenedores cada 10s
        y actualiza active_services si hay cambios.
        """
        while self._monitor_running:
            try:
                self._sync_container_statuses()
            except Exception as e:
                print(f"⚠️  [Monitor] Error: {e}")
            time.sleep(5)  

    def _sync_container_statuses(self):
        """Sincroniza el estado de active_services con Docker."""
        if not self.active_services:
            return

        for service_id, service in list(self.active_services.items()):
            try:
                container = self.client.containers.get(service["container_id"])
                container.reload()

                # Mapear estado de Docker a estado de la plataforma
                status_map = {
                    "running":    "active",
                    "exited":     "inactive",
                    "paused":     "inactive",
                    "restarting": "inactive",
                    "dead":       "inactive",
                    "created":    "inactive",
                }
                new_status = status_map.get(container.status, "inactive")
                old_status = service.get("status")

                # Solo actualizar si cambió el estado
                if new_status != old_status:
                    print(f"🔄 [Monitor] {service['container_name']}: {old_status} → {new_status}")
                    self.active_services[service_id]["status"] = new_status

            except docker.errors.NotFound:
                # El contenedor fue eliminado externamente
                print(f"⚠️  [Monitor] Contenedor no encontrado, marcando como inactive: {service['container_name']}")
                self.active_services[service_id]["status"] = "inactive"

            except Exception as e:
                print(f"⚠️  [Monitor] Error revisando {service.get('container_name')}: {e}")

    # ─────────────────────────────────────────────────────
    # Build de imágenes base
    # ─────────────────────────────────────────────────────

    def _build_base_images(self):
        base_images = {
            "python": {
                "tag": "ms-platform-python:latest",
                "path": os.path.join(self.templates_dir, "python")
            },
            "javascript": {
                "tag": "ms-platform-javascript:latest",
                "path": os.path.join(self.templates_dir, "javascript")
            }
        }
        
        for lang, config in base_images.items():
            try:
                self.client.images.get(config["tag"])
                print(f"  [{lang}] Imagen ya existe, saltando build.")
            except docker.errors.ImageNotFound:
                print(f"  [{lang}] Construyendo imagen base...")
                self.client.images.build(
                    path=config["path"],
                    tag=config["tag"],
                    rm=True
                )
                print(f"  [{lang}] Imagen lista.")

    # ─────────────────────────────────────────────────────
    # Parsers
    # ─────────────────────────────────────────────────────

    def _parse_python_params(self, code: str) -> dict:
        tree = ast.parse(code)

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                params = []
                args = node.args
                num_args = len(args.args)
                num_defaults = len(args.defaults)
                num_without_default = num_args - num_defaults

                for i, arg in enumerate(args.args):
                    if arg.arg == "self":
                        continue

                    param = {
                        "name": arg.arg,
                        "required": i < num_without_default,
                        "default": None,
                        "type": None
                    }

                    default_index = i - num_without_default
                    if default_index >= 0:
                        default_node = args.defaults[default_index]
                        if isinstance(default_node, ast.Constant):
                            param["default"] = default_node.value

                    if arg.annotation and isinstance(arg.annotation, ast.Name):
                        param["type"] = arg.annotation.id

                    params.append(param)

                return {"function": node.name, "params": params}

        raise Exception("No se encontró ninguna función en el código")

    def _parse_js_params(self, service_id: str, code: str) -> dict:
        """Usa acorn desde el contenedor para parsear parámetros de JS."""
        
        parse_script = """
const acorn = require('acorn');
const code = process.env.USER_CODE || '';

try {
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' });

    function getParams(funcNode) {
        return funcNode.params.map(param => {
            if (param.type === 'AssignmentPattern') {
                return {
                    name: param.left.name,
                    required: false,
                    default: param.right.value ?? null,
                    type: null
                };
            }
            return { name: param.name, required: true, default: null, type: null };
        });
    }

    for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration') {
            console.log(JSON.stringify({ function: node.id.name, params: getParams(node) }));
            process.exit(0);
        }
        if (
            node.type === 'VariableDeclaration' &&
            node.declarations[0].init &&
            (
                node.declarations[0].init.type === 'ArrowFunctionExpression' ||
                node.declarations[0].init.type === 'FunctionExpression'
            )
        ) {
            console.log(JSON.stringify({ function: node.declarations[0].id.name, params: getParams(node.declarations[0].init) }));
            process.exit(0);
        }
    }
    console.log(JSON.stringify({ error: 'No se encontró ninguna función' }));
} catch(e) {
    console.log(JSON.stringify({ error: e.message }));
}
"""
        container_name = self.active_services[service_id]["container_name"]
        container = self.client.containers.get(container_name)
        result = container.exec_run(["node", "-e", parse_script])
        
        return json.loads(result.output.decode())

    def _parse_params(self, service_id: str, code: str, language: str) -> dict:
        """Delega al parser según el lenguaje."""
        try:
            if language == "python":
                return self._parse_python_params(code)
            elif language == "javascript":
                return self._parse_js_params(service_id, code)
            else:
                raise Exception(f"Lenguaje '{language}' no soportado")
        except Exception as e:
            # Si falla el parser no rompemos la creación del microservicio
            print(f"⚠️  [Parser] Error: {str(e)}")
            return {"function": None, "params": []}

    # ─────────────────────────────────────────────────────
    # CRUD de microservicios
    # ─────────────────────────────────────────────────────

    def _wait_for_container(self, container, timeout: int = 10):
        """Espera a que el contenedor esté en estado running."""
        start = time.time()
        while time.time() - start < timeout:
            container.reload()
            if container.status == "running":
                print(f"✅ Contenedor listo: {container.name}")
                return
            print(f"⏳ Esperando contenedor {container.name} ({container.status})...")
            time.sleep(0.5)
        raise Exception(f"Timeout esperando el contenedor {container.name}")

    def create_microservice(self, name: str, code: str, language: str, description: str = "") -> dict:
        """
        Crea un contenedor usando la imagen base ya construida.
        El código del usuario se inyecta como variable de entorno.
        """
        service_id = str(uuid.uuid4())[:8]
        container_name = f"ms-{name}-{service_id}"
        
        # Usa la imagen base pre-construida según el lenguaje
        images = {
            "python": "ms-platform-python:latest",
            "javascript": "ms-platform-javascript:latest"
        }
        image = images.get(language)
        if not image:
            raise Exception(f"Lenguaje '{language}' no soportado. Usa 'python' o 'javascript'.")

        try:
            container = self.client.containers.run(
                image=image,
                name=container_name,
                # El código llega como variable de entorno, no hay build
                environment={
                    "USER_CODE": code,
                    "SERVICE_NAME": name
                },
                network=self.network_name,
                detach=True,
                remove=False,
                labels={
                    "platform": "microservice-platform",
                    "service_id": service_id
                }
            )

            self._wait_for_container(container)

            self.active_services[service_id] = {
                "container_id": container.id,
                "container_name": container_name,
                "name": name,
                "language": language,
                "code": code,
                "description": description,
                "status": "active",
                "endpoint": f"/api/services/{name}-{service_id}",
                "function": None,
                "params": []
            }
            
            params_info = self._parse_params(service_id, code, language)
            self.active_services[service_id]["function"] = params_info.get("function")
            self.active_services[service_id]["params"] = params_info.get("params", [])
            
            
            print(f"✅ Microservicio creado: {container_name}")
            print(f"   Función: {params_info.get('function')}")
            print(f"   Parámetros: {params_info.get('params')}")

            return {
                "service_id": service_id,
                "container_name": container_name,
                "endpoint": f"/api/services/{name}-{service_id}",
                "function": params_info.get("function"),
                "params": params_info.get("params", [])
            }

        except Exception as e:
            raise Exception(f"Error creando contenedor: {str(e)}")

    def get_service_params(self, service_id: str) -> dict:
        """Retorna los parámetros ya almacenados, sin reparsear."""
        if service_id not in self.active_services:
            raise Exception(f"Microservicio '{service_id}' no encontrado")

        service = self.active_services[service_id]
        return {
            "function": service.get("function"),
            "params": service.get("params", [])
        }

    def _stop_and_remove_container(self, container):
        """Detiene y elimina un contenedor individual."""
        try:
            container.stop(timeout=3)
            container.remove(force=True)
            print(f"🗑️  Contenedor eliminado: {container.name}")
        except Exception as e:
            print(f"⚠️  Error eliminando {container.name}: {e}")
            try:
                container.remove(force=True)
            except Exception as e2:
                print(f"⚠️  Error forzando eliminación {container.name}: {e2}")

    def stop_microservice(self, service_id: str):
        """Detiene y elimina un microservicio."""
        if service_id in self.active_services:
            info = self.active_services[service_id]
            try:
                container = self.client.containers.get(info["container_id"])
                self._stop_and_remove_container(container)
                del self.active_services[service_id]
            except docker.errors.NotFound:
                # El contenedor ya no existe, solo limpiar el registro
                del self.active_services[service_id]
            except Exception as e:
                print(f"Error deteniendo contenedor: {e}")

    def enable_microservice(self, service_id: str):
        # Inicia el contenedor de un microservicio deshabilitado.
        if service_id not in self.active_services:
            raise Exception(f"Microservicio '{service_id}' no encontrado")

        info = self.active_services[service_id]
        try:
            container = self.client.containers.get(info["container_id"])
            container.start()
            self.active_services[service_id]["status"] = "active"
            print(f"✅ Microservicio habilitado: {info['container_name']}")
        except Exception as e:
            raise Exception(f"Error habilitando microservicio: {str(e)}")

    def disable_microservice(self, service_id: str):
        if service_id not in self.active_services:
            raise Exception(f"Microservicio '{service_id}' no encontrado")

        info = self.active_services[service_id]
        try:
            container = self.client.containers.get(info["container_id"])
            container.stop()
            self.active_services[service_id]["status"] = "inactive"
            print(f"✅ Microservicio deshabilitado: {info['container_name']}")
        except Exception as e:
            raise Exception(f"Error deshabilitando microservicio: {str(e)}")

    def cleanup_all(self):
        """Limpia todos los microservicios en paralelo al apagar la plataforma."""
        
        
        self._stop_monitor()

        containers_to_remove = []

        # Los registrados en active_services
        for service_id, info in list(self.active_services.items()):
            try:
                container = self.client.containers.get(info["container_id"])
                containers_to_remove.append(container)
            except docker.errors.NotFound:
                pass
            except Exception as e:
                print(f"⚠️  Error obteniendo contenedor {service_id}: {e}")

        # Los huérfanos (por si acaso)
        try:
            orphans = self.client.containers.list(
            all=True,  
            filters={"label": "platform=microservice-platform"}
            )
            for c in orphans:
                if c not in containers_to_remove:
                    containers_to_remove.append(c)
        except Exception as e:
            print(f"⚠️  Error buscando huérfanos: {e}")

        if not containers_to_remove:
            print("✅ No hay contenedores que limpiar")
            self.active_services.clear()
            return

        print(f"🗑️  Eliminando {len(containers_to_remove)} contenedor(es) en paralelo...")

        # Eliminar todos en paralelo con threads
        threads = []
        for container in containers_to_remove:
            t = threading.Thread(
                target=self._stop_and_remove_container,
                args=(container,),
                daemon=True
            )
            threads.append(t)
            t.start()

        # Esperar a que todos terminen con timeout global
        for t in threads:
            t.join(timeout=10)

        # Limpiar el registro
        self.active_services.clear()
        print("✅ Limpieza completa")