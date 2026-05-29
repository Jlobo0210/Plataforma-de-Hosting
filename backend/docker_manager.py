import docker
import uuid
import os
import time
import threading
import git
import tempfile
import shutil
import urllib.request

from env_utils import normalize_root_path, parse_env_content, write_build_env_files
from python_on_whales import DockerClient

def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


IDLE_TIMEOUT_SECONDS = _env_int("IDLE_TIMEOUT_SECONDS", 30 * 60)
MONITOR_INTERVAL_SECONDS = _env_int("MONITOR_INTERVAL_SECONDS", 5)
IDLE_WATCHER_INTERVAL_SECONDS = _env_int("IDLE_WATCHER_INTERVAL_SECONDS", 60)
HTTP_READY_TIMEOUT_SECONDS = _env_int("HTTP_READY_TIMEOUT_SECONDS", 15)
REQUESTS_LIMIT_PER_MIN = _env_int("REQUESTS_LIMIT_PER_MIN", 60)
DEFAULT_MEMORY_LIMIT_MB = 256
DEFAULT_CPU_LIMIT_VCPU = 0.5


def _cpu_percent_from_stats(stats: dict) -> float:
    try:
        cpu_stats = stats.get("cpu_stats") or {}
        precpu_stats = stats.get("precpu_stats") or {}
        cpu_usage = cpu_stats.get("cpu_usage") or {}
        precpu_usage = precpu_stats.get("cpu_usage") or {}

        cpu_delta = cpu_usage.get("total_usage", 0) - precpu_usage.get("total_usage", 0)
        system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)

        if system_delta <= 0 or cpu_delta <= 0:
            return 0.0

        percpu = cpu_usage.get("percpu_usage") or []
        cpu_count = len(percpu) if percpu else 1
        return (cpu_delta / system_delta) * cpu_count * 100.0
    except (TypeError, ZeroDivisionError, KeyError):
        return 0.0


def _memory_mb_from_stats(stats: dict) -> int:
    try:
        usage = stats.get("memory_stats", {}).get("usage", 0)
        return int(usage // (1024 * 1024))
    except (TypeError, KeyError):
        return 0


def _limits_from_container(container) -> tuple[int, float]:
    host = container.attrs.get("HostConfig") or {}
    mem = host.get("Memory") or 0
    memory_limit_mb = int(mem // (1024 * 1024)) if mem > 0 else DEFAULT_MEMORY_LIMIT_MB
    nano_cpus = host.get("NanoCpus") or 0
    cpu_limit_vcpu = nano_cpus / 1_000_000_000 if nano_cpus > 0 else DEFAULT_CPU_LIMIT_VCPU
    return memory_limit_mb, cpu_limit_vcpu


def _write_resources_override(compose_file: str, override_path: str) -> None:
    """
    Genera un docker-compose.platform-override.yml que aplica límites de
    CPU y memoria a todos los servicios definidos en el compose original.

    Estrategia: leer los servicios del compose del usuario con PyYAML,
    construir un override que solo toca deploy.resources, y pasarlo como
    segundo archivo a DockerClient. Así no se modifica el archivo original.

    Los límites (256 MB / 0.5 vCPU) coinciden con los aplicados a
    contenedores Dockerfile vía mem_limit y nano_cpus en _run_project_container.
    """
    import yaml  # import local: solo se usa aquí

    services: list[str] = []
    try:
        with open(compose_file, "r") as f:
            compose_data = yaml.safe_load(f) or {}
        services = list((compose_data.get("services") or {}).keys())
    except Exception as e:
        print(f"⚠️  No se pudo leer servicios del compose para override: {e}")

    if not services:
        # Sin servicios conocidos: override genérico vacío (no aplica nada,
        # pero al menos no rompe el up).
        with open(override_path, "w") as f:
            f.write("version: '3.8'\nservices: {}\n")
        return

    override: dict = {"version": "3.8", "services": {}}
    for svc in services:
        override["services"][svc] = {
            "deploy": {
                "resources": {
                    "limits": {
                        "cpus": str(DEFAULT_CPU_LIMIT_VCPU),   # "0.5"
                        "memory": f"{DEFAULT_MEMORY_LIMIT_MB}m",  # "256m"
                    }
                }
            }
        }

    with open(override_path, "w") as f:
        yaml.dump(override, f, default_flow_style=False)

    print(f"📋 Override de recursos generado ({len(services)} servicios): {override_path}")


class DockerManager:
    def __init__(self):
        self.client = docker.from_env()
        self.network_name = os.getenv("DOCKER_NETWORK", "platform_network")
        self.active_services = {}
        self._threads_started = False

    def start_background_threads(self) -> None:
        """
        Arranca los hilos de monitoreo. Se invoca desde el lifespan de la
        app, no desde __init__, para evitar que corran durante imports en
        tests o durante el cleanup_all inicial.
        """
        if self._threads_started:
            return
        self._threads_started = True
        threading.Thread(target=self._monitor_loop, daemon=True).start()
        threading.Thread(target=self._idle_watcher, daemon=True).start()
        print("👀 Hilos de monitoreo arrancados (status sync + idle watcher)")

    def _monitor_loop(self):
        """
        Sincroniza periódicamente el campo `status` con el estado real
        del contenedor en Docker. No sobreescribe `idle` ni `inactive`,
        que son estados lógicos manejados por el watcher / el usuario.
        """
        while True:
            for pid, info in list(self.active_services.items()):
                try:
                    container = self.client.containers.get(info["container_id"])
                    container.reload()
                    if info.get("status") in ("idle", "inactive"):
                        continue
                    info["status"] = "active" if container.status == "running" else "inactive"
                except docker.errors.NotFound:
                    info["status"] = "inactive"
                except Exception as e:
                    print(f"⚠️  [Monitor] Error revisando {info.get('container_name')}: {e}")
            time.sleep(MONITOR_INTERVAL_SECONDS)

    def _idle_watcher(self):
        """Apaga contenedores con más de IDLE_TIMEOUT_SECONDS sin tráfico."""
        while True:
            now = time.time()
            for pid, info in list(self.active_services.items()):
                if info.get("status") != "active":
                    continue
                last = info.get("last_active", now)
                if now - last > IDLE_TIMEOUT_SECONDS:
                    self._idle_stop(pid)
            time.sleep(IDLE_WATCHER_INTERVAL_SECONDS)

    def _idle_stop(self, project_id: str):
        info = self.active_services.get(project_id)
        if not info:
            return
        try:
            if info.get("container_type") == "docker-compose" and info.get("compose_project_name"):
                # Para compose: parar todo el stack, no solo el contenedor principal
                whale = DockerClient(compose_project_name=info["compose_project_name"])
                whale.compose.stop()
                # Sincronizar status del mapa de servicios
                for service_info in info.get("services", {}).values():
                    try:
                        c = self.client.containers.get(service_info["container_id"])
                        c.reload()
                        service_info["status"] = c.status
                    except Exception:
                        pass
                print(f"💤 Stack compose apagado por inactividad: {info['compose_project_name']}")
            else:
                container = self.client.containers.get(info["container_id"])
                container.stop(timeout=5)
                print(f"💤 Apagado por inactividad: {info['container_name']}")

            info["status"] = "idle"
        except Exception as e:
            print(f"⚠️  Error apagando por idle {info.get('container_name')}: {e}")

    def _record_activity(self, project_id: str):
        info = self.active_services.get(project_id)
        if info is None:
            return
        now = time.time()
        info["last_active"] = now
        timestamps = info.setdefault("request_timestamps", [])
        timestamps.append(now)
        cutoff = now - 60
        info["request_timestamps"] = [t for t in timestamps if t >= cutoff]

    def _get_metric_container_ids(self, info: dict) -> list[str]:
        if info.get("container_type") == "docker-compose" and info.get("services"):
            return [
                s["container_id"]
                for s in info["services"].values()
                if s.get("container_id")
            ]
        if info.get("container_id"):
            return [info["container_id"]]
        return []

    def get_project_metrics(self, project_id: str) -> dict:
        info = self.active_services.get(project_id)
        if not info:
            return {
                "cpu_percent": 0.0,
                "memory_mb": 0,
                "memory_limit_mb": DEFAULT_MEMORY_LIMIT_MB,
                "cpu_limit_vcpu": DEFAULT_CPU_LIMIT_VCPU,
                "requests_per_min": 0,
                "requests_limit_per_min": REQUESTS_LIMIT_PER_MIN,
            }

        now = time.time()
        requests_per_min = len([
            t for t in info.get("request_timestamps", [])
            if now - t < 60
        ])

        container_ids = self._get_metric_container_ids(info)
        mem_limit_total = 0
        cpu_limit_total = 0.0

        if info.get("status") == "inactive" or not container_ids:
            for cid in container_ids:
                try:
                    container = self.client.containers.get(cid)
                    mem_lim, cpu_lim = _limits_from_container(container)
                    mem_limit_total += mem_lim
                    cpu_limit_total += cpu_lim
                except docker.errors.NotFound:
                    pass
            if mem_limit_total == 0:
                mem_limit_total = DEFAULT_MEMORY_LIMIT_MB * max(len(container_ids), 1)
            if cpu_limit_total == 0:
                cpu_limit_total = DEFAULT_CPU_LIMIT_VCPU * max(len(container_ids), 1)
            return {
                "cpu_percent": 0.0,
                "memory_mb": 0,
                "memory_limit_mb": mem_limit_total,
                "cpu_limit_vcpu": round(cpu_limit_total, 2),
                "requests_per_min": 0,
                "requests_limit_per_min": REQUESTS_LIMIT_PER_MIN,
            }

        cpu_total = 0.0
        mem_total = 0
        any_running = False

        for cid in container_ids:
            try:
                container = self.client.containers.get(cid)
                container.reload()
                mem_lim, cpu_lim = _limits_from_container(container)
                mem_limit_total += mem_lim
                cpu_limit_total += cpu_lim

                if container.status != "running":
                    continue

                any_running = True
                stats = container.stats(stream=False)
                cpu_total += _cpu_percent_from_stats(stats)
                mem_total += _memory_mb_from_stats(stats)
            except docker.errors.NotFound:
                pass
            except Exception as e:
                print(f"⚠️  Error obteniendo stats de {cid}: {e}")

        if mem_limit_total == 0:
            mem_limit_total = DEFAULT_MEMORY_LIMIT_MB * max(len(container_ids), 1)
        if cpu_limit_total == 0:
            cpu_limit_total = DEFAULT_CPU_LIMIT_VCPU * max(len(container_ids), 1)

        return {
            "cpu_percent": round(cpu_total, 1) if any_running else 0.0,
            "memory_mb": mem_total,
            "memory_limit_mb": mem_limit_total,
            "cpu_limit_vcpu": round(cpu_limit_total, 2),
            "requests_per_min": requests_per_min,
            "requests_limit_per_min": REQUESTS_LIMIT_PER_MIN,
        }

    def wake_project(self, project_id: str):
        """
        Garantiza que el contenedor del proyecto esté corriendo y refresca
        `last_active`. Llamado por el endpoint `/_wake` desde NGINX en
        cada request del usuario.

        Excepciones:
        - KeyError: el proyecto no existe (NGINX devolverá 500 al cliente).
        - PermissionError: el dueño lo deshabilitó manualmente; no se
          revive (NGINX devolverá 500; el dueño debe hacer PATCH /enable).
        - RuntimeError: cold start falló (timeout, etc.).
        """
        if project_id not in self.active_services:
            raise KeyError(project_id)

        info = self.active_services[project_id]

        if info.get("status") == "inactive":
            raise PermissionError("Proyecto deshabilitado por el usuario")

        self._record_activity(project_id)

        if info.get("status") == "active":
            return

        try:
            if info.get("container_type") == "docker-compose" and info.get("compose_project_name"):
                # Para compose: arrancar todo el stack, no solo el contenedor principal
                whale = DockerClient(compose_project_name=info["compose_project_name"])
                whale.compose.start()
                # Reconectar el contenedor principal a platform_network si se perdió la conexión
                try:
                    main_container = self.client.containers.get(info["container_id"])
                    network = self.client.networks.get(self.network_name)
                    network.connect(main_container)
                except Exception:
                    pass  # Ya conectado o error no crítico
                # Sincronizar status del mapa de servicios
                for service_info in info.get("services", {}).values():
                    try:
                        c = self.client.containers.get(service_info["container_id"])
                        c.reload()
                        service_info["status"] = c.status
                    except Exception:
                        pass
                self._wait_for_http_ready(info["container_name"], info["port"])
                print(f"⚡ Wake-on-request (compose): {info['compose_project_name']}")
            else:
                container = self.client.containers.get(info["container_id"])
                container.start()
                self._wait_for_container(container, timeout=15)
                self._wait_for_http_ready(info["container_name"], info["port"])
                print(f"⚡ Wake-on-request: {info['container_name']}")

            info["status"] = "active"
        except Exception as e:
            raise RuntimeError(f"Cold start falló: {e}")

    def _wait_for_container(self, container, timeout: int = 10):
        start = time.time()
        while time.time() - start < timeout:
            container.reload()
            if container.status == "running":
                print(f"✅ Contenedor listo: {container.name}")
                return
            print(f"⏳ Esperando contenedor {container.name} ({container.status})...")
            time.sleep(0.5)
        raise Exception(f"Timeout esperando el contenedor {container.name}")

    def _wait_for_http_ready(self, container_name: str, port: int, timeout: int | None = None):
        """Espera a que la app dentro del contenedor responda HTTP (evita 502 tras wake)."""
        timeout = timeout or HTTP_READY_TIMEOUT_SECONDS
        url = f"http://{container_name}:{port}/"
        start = time.time()
        last_error = "sin intentos"
        while time.time() - start < timeout:
            try:
                req = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(req, timeout=2) as resp:
                    if resp.status < 500:
                        print(f"✅ HTTP listo: {container_name}:{port}")
                        return
            except Exception as e:
                last_error = str(e)
            time.sleep(0.5)
        raise Exception(f"Timeout esperando HTTP en {container_name}:{port} ({last_error})")

    def _stop_and_remove_container(self, container):
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

    def _run_project_container(
        self,
        *,
        image_tag: str,
        container_name: str,
        project_id: str,
        username: str,
        environment: dict[str, str] | None = None,
    ):
        run_kwargs = {
            "image": image_tag,
            "name": container_name,
            "network": self.network_name,
            "detach": True,
            "remove": False,
            "mem_limit": "256m",
            "nano_cpus": 500_000_000,
            "labels": {
                "platform": "hosting-platform",
                "project_id": project_id,
                "username": username,
            },
        }
        if environment:
            run_kwargs["environment"] = environment

        print(f"🚀 Lanzando contenedor {container_name}...")
        container = self.client.containers.run(**run_kwargs)
        self._wait_for_container(container)
        return container

    def _resolve_build_context(self, repo_root: str, normalized_root: str) -> str:
        if normalized_root == ".":
            return repo_root
        return os.path.join(repo_root, normalized_root)

    def _build_dockerfile_image(self, build_context: str, image_tag: str, env_content: str, *, normalized_root: str, root_path: str, ) -> None:
        dockerfile_path = os.path.join(build_context, "Dockerfile")
        if not os.path.isdir(build_context):
            raise Exception(f"La ruta '{root_path}' no existe en el repositorio")
        if not os.path.exists(dockerfile_path):
            display_path = normalized_root if normalized_root != "." else "la raíz del repositorio"
            raise Exception(f"No se encontró Dockerfile en '{display_path}'")

        write_build_env_files(build_context, env_content)
        parsed_env = parse_env_content(env_content)

        build_kwargs = {
            "path": build_context,
            "tag": image_tag,
            "rm": True,
        }
        if parsed_env:
            build_kwargs["buildargs"] = parsed_env

        print(f"🔨 Construyendo imagen desde Dockerfile en {normalized_root}...")
        image, logs = self.client.images.build(**build_kwargs)
        for log in logs:
            if "stream" in log:
                print(log["stream"].strip())

    def _rebuild_project_image(self, info: dict, env_content: str, tmp_dir: str) -> None:
        normalized_root = info.get("root_path", ".")
        build_context = self._resolve_build_context(tmp_dir, normalized_root)
        self._build_dockerfile_image(
            build_context,
            info["image_tag"],
            env_content,
            normalized_root=normalized_root,
            root_path=normalized_root if normalized_root != "." else ".",
        )
    
    def _deploy_compose(
        self,
        *,
        build_context: str,
        project_id: str,
        username: str,
        port: int,
        env_content: str,
        compose_project_name: str | None = None,
    ) -> tuple[docker.models.containers.Container, dict, str]:
        """
        Levanta un proyecto docker-compose, registra todos sus servicios
        y retorna el contenedor principal (el que expone el puerto indicado).
        """

        compose_file = os.path.join(build_context, "docker-compose.yml")
        compose_file_yaml = os.path.join(build_context, "docker-compose.yaml")

        if not os.path.exists(compose_file) and not os.path.exists(compose_file_yaml):
            raise Exception("No se encontró docker-compose.yml en la ruta indicada del repositorio")

        # Escribe el .env si el usuario proporcionó variables
        write_build_env_files(build_context, env_content)

        if compose_project_name is None:
            compose_project_name = f"hosting-{username}-{project_id}"

        # ── Inyectar límites CPU/memoria vía override ─────────────────
        # docker-compose ignora --cpus/--memory del CLI; los límites deben
        # estar en el YAML bajo deploy.resources. En lugar de modificar el
        # archivo del usuario, creamos un override que los sobreescribe en
        # todos los servicios sin alterar el docker-compose.yml original.
        active_compose_file = compose_file if os.path.exists(compose_file) else compose_file_yaml
        override_file = os.path.join(build_context, "docker-compose.platform-override.yml")
        _write_resources_override(active_compose_file, override_file)

        print(f"🔨 Levantando docker-compose ({compose_project_name})...")
        compose_files = [active_compose_file, override_file]
        whale = DockerClient(
            compose_files=compose_files,
            compose_project_name=compose_project_name,
        )
        whale.compose.up(
            build=True,
            detach=True,
            quiet=False,
        )

        # ── Obtener todos los contenedores del compose ────────────────
        compose_containers = whale.compose.ps() 

        if not compose_containers:
            raise Exception("docker-compose no levantó ningún contenedor")

        # ── Identificar el contenedor principal ───────────────────────
        # Es el primero que expone el puerto indicado por el usuario.
        # Si ninguno lo expone explícitamente, tomamos el primero.
        main_container_whales = None
        for c in compose_containers:
            try:
                # En python-on-whales los puertos son strings tipo "80/tcp"
                ports = c.network_settings.ports or {}
                port_keys = list(ports.keys()) if isinstance(ports, dict) else []
                exposed_ports = [p.split("/")[0] for p in port_keys]
                if str(port) in exposed_ports:
                    main_container_whales = c
                    break
            except Exception:
                pass
        if main_container_whales is None:
            main_container_whales = compose_containers[0]

        # Convertir a objeto docker-sdk para ser consistente con el resto
        main_container = self.client.containers.get(main_container_whales.id)

        # ── Conectar todos los contenedores a platform_network ────────
        # docker-compose crea su propia red, pero NGINX necesita alcanzar el contenedor principal por platform_network.
        try:
            network = self.client.networks.get(self.network_name)
            network.connect(main_container)
            print(f"🔗 Contenedor principal conectado a {self.network_name}")
        except Exception as e:
            print(f"⚠️  No se pudo conectar a {self.network_name}: {e}")

        # ── Agregar labels de plataforma al contenedor principal ──────
        # No se pueden agregar labels post-creación en Docker, así que los guardamos solo en active_services.

        # ── Construir el mapa de servicios ────────────────────────────
        services_map = {}
        for c in compose_containers:
            sdk_container = self.client.containers.get(c.id)

            # Límites de recursos
            try:
                sdk_container.update(
                    cpu_quota=50000,
                    cpu_period=100000,
                    mem_limit="256m",
                )
                print(f"✅ Límites aplicados: {sdk_container.name}")
            except Exception as e:
                print(f"⚠️  No se pudieron aplicar límites a {c.id}: {e}")

            # Mapa de servicios
            try:
                labels = c.config.labels or {}
                service_name = labels.get("com.docker.compose.service", sdk_container.name)
            except Exception:
                service_name = sdk_container.name
            services_map[service_name] = {
                "container_id": sdk_container.id,
                "container_name": sdk_container.name,
                "status": sdk_container.status,
            }

        print(f"✅ docker-compose levantado — servicios: {list(services_map.keys())}")
        print(f"   Contenedor principal: {main_container.name}")

        # Guardamos el nombre del proyecto compose para poder hacer
        # compose down después
        return main_container, services_map, compose_project_name

    def deploy_project(self, name: str, username: str, repo_url: str, container_type: str, port: int, description: str = "", root_path: str = ".", env_content: str = "", ) -> dict:
        """
        Clona el repositorio del usuario y despliega el contenedor.
        """
        project_id = str(uuid.uuid4())[:8]
        container_name = f"project-{username}-{name}-{project_id}"
        image_tag = f"hosting-{username}-{name}:{project_id}"

        tmp_dir = tempfile.mkdtemp()
        normalized_root = normalize_root_path(root_path)
        parsed_env = parse_env_content(env_content)

        try:
            # Paso 1: Clonar el repositorio en una carpeta temporal
            print(f"📥 Clonando repositorio: {repo_url}")
            git.Repo.clone_from(repo_url, tmp_dir)
            print(f"✅ Repositorio clonado en {tmp_dir}")

            build_context = self._resolve_build_context(tmp_dir, normalized_root)

            # Valores por defecto para campos de compose
            services_map = {}
            compose_project_name = None

            # Paso 2: Construir la imagen según el tipo de contenedor
            if container_type == "dockerfile":
                self._build_dockerfile_image(
                    build_context,
                    image_tag,
                    env_content,
                    normalized_root=normalized_root,
                    root_path=root_path,
                )

                # Paso 3: Lanzar el contenedor con límites de recursos
                container = self._run_project_container(
                    image_tag=image_tag,
                    container_name=container_name,
                    project_id=project_id,
                    username=username,
                    environment=parsed_env or None,
                )
                self._wait_for_http_ready(container_name, port)

            elif container_type == "docker-compose":
                main_container, services_map, compose_project_name = self._deploy_compose(
                    build_context=build_context,
                    project_id=project_id,
                    username=username,
                    port=port,
                    env_content=env_content,
                )
                container = main_container
                container_name = main_container.name
                self._wait_for_http_ready(container.name, port)
            else:
                raise Exception(f"Tipo de contenedor '{container_type}' no soportado")

            # Paso 4: Registrar el proyecto en el estado activo
            self.active_services[project_id] = {
                "container_id": container.id,
                "container_name": container_name,
                "image_tag": image_tag,
                "name": name,
                "username": username,
                "repo_url": repo_url,
                "container_type": container_type,
                "port": port,
                "description": description,
                "root_path": normalized_root,
                "env_content": env_content,
                "status": "active",
                "last_active": time.time(),
                "hostname": None,
                "url": None,
                "endpoint": f"http://{name}.{username}.localhost",
                "services": services_map if container_type == "docker-compose" else {},
                "compose_project_name": compose_project_name if container_type == "docker-compose" else None,
            }

            print(f"✅ Proyecto desplegado: {container_name}")

            return {
                "project_id": project_id,
                "container_name": container_name,
                "endpoint": f"http://{name}.{username}.localhost"
            }

        except Exception as e:
            try:
                self.client.images.remove(image_tag, force=True)
            except:
                pass
            raise Exception(f"Error desplegando proyecto: {str(e)}")

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            print(f"🧹 Carpeta temporal eliminada")

    def stop_project(self, project_id: str):
        """Detiene y elimina un proyecto."""
        if project_id not in self.active_services:
            return

        info = self.active_services[project_id]

        try:
            if info.get("container_type") == "docker-compose" and info.get("compose_project_name"):
                print(f"🗑️  Bajando docker-compose: {info['compose_project_name']}...")
                whale = DockerClient(compose_project_name=info["compose_project_name"])
                whale.compose.down(
                    remove_orphans=True,
                    volumes=False,
                )
                print(f"✅ docker-compose bajado: {info['compose_project_name']}")

            else:
                container = self.client.containers.get(info["container_id"])
                self._stop_and_remove_container(container)
                try:
                    self.client.images.remove(info["image_tag"], force=True)
                    print(f"🗑️  Imagen eliminada: {info['image_tag']}")
                except Exception as e:
                    print(f"⚠️  No se pudo eliminar imagen: {e}")

        except docker.errors.NotFound:
            pass
        except Exception as e:
            print(f"⚠️  Error deteniendo proyecto: {e}")
        finally:
            del self.active_services[project_id]

    def enable_project(self, project_id: str):
        """Inicia un proyecto detenido."""
        if project_id not in self.active_services:
            raise Exception(f"Proyecto '{project_id}' no encontrado")

        info = self.active_services[project_id]

        try:
            if info.get("container_type") == "docker-compose" and info.get("compose_project_name"):
                print(f"▶️  Iniciando docker-compose: {info['compose_project_name']}...")
                whale = DockerClient(compose_project_name=info["compose_project_name"])
                whale.compose.start()

                for service_name, service_info in info.get("services", {}).items():
                    try:
                        c = self.client.containers.get(service_info["container_id"])
                        c.reload()
                        service_info["status"] = c.status
                    except Exception:
                        pass

            else:
                container = self.client.containers.get(info["container_id"])
                container.start()
                self._wait_for_container(container, timeout=15)
                self._wait_for_http_ready(info["container_name"], info["port"])

            info["status"] = "active"
            info["last_active"] = time.time()
            print(f"✅ Proyecto habilitado: {info['container_name']}")

        except Exception as e:
            raise Exception(f"Error habilitando proyecto: {str(e)}")

    def update_project_env(self, project_id: str, env_content: str):
        """Actualiza el .env del proyecto reconstruyendo o recreando el stack según el tipo."""
        if project_id not in self.active_services:
            raise Exception(f"Proyecto '{project_id}' no encontrado")

        info = self.active_services[project_id]
        parsed_env = parse_env_content(env_content)
        info["env_content"] = env_content

        container_type = info.get("container_type")
        if container_type not in ("dockerfile", "docker-compose"):
            raise Exception(f"Tipo de contenedor '{container_type}' no soportado para actualizar variables")

        tmp_dir = tempfile.mkdtemp()
        try:
            print(f"📥 Re-clonando repositorio: {info['repo_url']}")
            git.Repo.clone_from(info["repo_url"], tmp_dir)

            if container_type == "dockerfile":
                try:
                    container = self.client.containers.get(info["container_id"])
                    self._stop_and_remove_container(container)
                except docker.errors.NotFound:
                    pass

                self._rebuild_project_image(info, env_content, tmp_dir)

                container = self._run_project_container(
                    image_tag=info["image_tag"],
                    container_name=info["container_name"],
                    project_id=project_id,
                    username=info["username"],
                    environment=parsed_env or None,
                )

                info["container_id"] = container.id
                print(f"♻️  Variables de entorno actualizadas (rebuild): {info['container_name']}")

            else:
                compose_project_name = info.get("compose_project_name")
                if not compose_project_name:
                    raise Exception("Proyecto compose sin compose_project_name registrado")

                print(f"🗑️  Bajando docker-compose para actualizar env: {compose_project_name}...")
                whale = DockerClient(compose_project_name=compose_project_name)
                whale.compose.down(
                    remove_orphans=True,
                    volumes=False,
                )

                build_context = self._resolve_build_context(tmp_dir, info.get("root_path", "."))
                main_container, services_map, _ = self._deploy_compose(
                    build_context=build_context,
                    project_id=project_id,
                    username=info["username"],
                    port=info["port"],
                    env_content=env_content,
                    compose_project_name=compose_project_name,
                )

                info["container_id"] = main_container.id
                info["container_name"] = main_container.name
                info["services"] = services_map
                self._wait_for_http_ready(main_container.name, info["port"])
                print(f"♻️  Variables de entorno actualizadas (compose): {main_container.name}")

            info["status"] = "active"
            info["last_active"] = time.time()
        except Exception as e:
            raise Exception(f"Error actualizando variables de entorno: {str(e)}")
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def disable_project(self, project_id: str):
        """Detiene un proyecto sin eliminarlo."""
        if project_id not in self.active_services:
            raise Exception(f"Proyecto '{project_id}' no encontrado")

        info = self.active_services[project_id]

        try:
            if info.get("container_type") == "docker-compose" and info.get("compose_project_name"):
                print(f"⏸️  Deteniendo docker-compose: {info['compose_project_name']}...")
                whale = DockerClient(compose_project_name=info["compose_project_name"])
                whale.compose.stop()

                for service_name, service_info in info.get("services", {}).items():
                    try:
                        c = self.client.containers.get(service_info["container_id"])
                        c.reload()
                        service_info["status"] = c.status
                    except Exception:
                        pass

            else:
                container = self.client.containers.get(info["container_id"])
                container.stop()

            info["status"] = "inactive"
            print(f"⏸️  Proyecto deshabilitado: {info['container_name']}")

        except Exception as e:
            raise Exception(f"Error deshabilitando proyecto: {str(e)}")

    def cleanup_all(self):
        """Limpia todos los proyectos al apagar la plataforma."""

        # ── Primero bajar los proyectos docker-compose ────────────────
        for project_id, info in list(self.active_services.items()):
            if info.get("container_type") == "docker-compose" and info.get("compose_project_name"):
                try:
                    print(f"🗑️  Bajando compose: {info['compose_project_name']}...")
                    whale = DockerClient(compose_project_name=info["compose_project_name"])
                    whale.compose.down(
                        remove_orphans=True,
                        volumes=False,
                    )
                    print(f"✅ Compose bajado: {info['compose_project_name']}")
                except Exception as e:
                    print(f"⚠️  Error bajando compose {info['compose_project_name']}: {e}")

        # ── Luego eliminar contenedores dockerfile en paralelo ────────
        containers_to_remove = []

        for project_id, info in list(self.active_services.items()):
            if info.get("container_type") == "docker-compose":
                continue
            try:
                container = self.client.containers.get(info["container_id"])
                containers_to_remove.append(container)
            except docker.errors.NotFound:
                pass
            except Exception as e:
                print(f"⚠️  Error obteniendo contenedor {project_id}: {e}")

        # Huérfanos dockerfile por si acaso
        try:
            orphans = self.client.containers.list(
                all=True,
                filters={"label": "platform=hosting-platform"}
            )
            for c in orphans:
                if c not in containers_to_remove:
                    containers_to_remove.append(c)
        except Exception as e:
            print(f"⚠️  Error buscando huérfanos: {e}")

        if containers_to_remove:
            print(f"🗑️  Eliminando {len(containers_to_remove)} contenedor(es) dockerfile...")
            threads = []
            for container in containers_to_remove:
                t = threading.Thread(
                    target=self._stop_and_remove_container,
                    args=(container,),
                    daemon=True
                )
                threads.append(t)
                t.start()
            for t in threads:
                t.join(timeout=10)
        else:
            print("✅ No hay contenedores que limpiar")

        self.active_services.clear()
        print("✅ Limpieza completa")