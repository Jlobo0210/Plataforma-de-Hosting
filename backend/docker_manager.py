import docker
import uuid
import os
import time
import threading
import git
import tempfile
import shutil


IDLE_TIMEOUT_SECONDS = 30 * 60  # PDF: apagar contenedores tras 30 min sin tráfico
MONITOR_INTERVAL_SECONDS = 5
IDLE_WATCHER_INTERVAL_SECONDS = 60


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
            container = self.client.containers.get(info["container_id"])
            container.stop(timeout=5)
            info["status"] = "idle"
            print(f"💤 Apagado por inactividad: {info['container_name']}")
        except Exception as e:
            print(f"⚠️  Error apagando por idle {info.get('container_name')}: {e}")

    def _record_activity(self, project_id: str):
        info = self.active_services.get(project_id)
        if info is not None:
            info["last_active"] = time.time()

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
            container = self.client.containers.get(info["container_id"])
            container.start()
            self._wait_for_container(container, timeout=15)
            info["status"] = "active"
            print(f"⚡ Wake-on-request: {info['container_name']}")
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



    def deploy_project(self, name: str, username: str, repo_url: str, container_type: str, port: int, description: str = "") -> dict:
        """
        Clona el repositorio del usuario y despliega el contenedor.
        """
        project_id = str(uuid.uuid4())[:8]
        container_name = f"project-{username}-{name}-{project_id}"
        image_tag = f"hosting-{username}-{name}:{project_id}"

        tmp_dir = tempfile.mkdtemp()

        try:
            # Paso 1: Clonar el repositorio en una carpeta temporal
            print(f"📥 Clonando repositorio: {repo_url}")
            git.Repo.clone_from(repo_url, tmp_dir)
            print(f"✅ Repositorio clonado en {tmp_dir}")

            # Paso 2: Construir la imagen según el tipo de contenedor
            if container_type == "dockerfile":
                dockerfile_path = os.path.join(tmp_dir, "Dockerfile")
                if not os.path.exists(dockerfile_path):
                    raise Exception("No se encontró un Dockerfile en la raíz del repositorio")

                print(f"🔨 Construyendo imagen desde Dockerfile...")
                image, logs = self.client.images.build(
                    path=tmp_dir,
                    tag=image_tag,
                    rm=True
                )
                for log in logs:
                    if "stream" in log:
                        print(log["stream"].strip())

            elif container_type == "docker-compose":
                raise Exception("docker-compose aún no está soportado en esta versión") #Se agrega después, ya que necesita diseño más complejo
            else:
                raise Exception(f"Tipo de contenedor '{container_type}' no soportado")

            # Paso 3: Lanzar el contenedor con límites de recursos
            print(f"🚀 Lanzando contenedor {container_name}...")
            container = self.client.containers.run(
                image=image_tag,
                name=container_name,
                network=self.network_name,
                detach=True,
                remove=False,
                mem_limit="256m",
                nano_cpus=500_000_000,
                labels={
                    "platform": "hosting-platform",
                    "project_id": project_id,
                    "username": username
                }
            )

            self._wait_for_container(container)

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
                "status": "active",
                "last_active": time.time(),
                "hostname": None,
                "url": None,
                "endpoint": f"http://{name}.{username}.localhost",
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
        if project_id in self.active_services:
            info = self.active_services[project_id]
            try:
                container = self.client.containers.get(info["container_id"])
                self._stop_and_remove_container(container)
                # Eliminar también la imagen construida
                self.client.images.remove(info["image_tag"], force=True)
                print(f"🗑️  Imagen eliminada: {info['image_tag']}")
            except docker.errors.NotFound:
                pass
            except Exception as e:
                print(f"⚠️  Error deteniendo proyecto: {e}")
            finally:
                del self.active_services[project_id]

    def enable_project(self, project_id: str):
        """
        Inicia un proyecto detenido manualmente (`inactive`) o por timeout
        (`idle`) y refresca `last_active`.
        """
        if project_id not in self.active_services:
            raise Exception(f"Proyecto '{project_id}' no encontrado")
        info = self.active_services[project_id]
        try:
            container = self.client.containers.get(info["container_id"])
            container.start()
            self._wait_for_container(container, timeout=15)
            info["status"] = "active"
            info["last_active"] = time.time()
            print(f"✅ Proyecto habilitado: {info['container_name']}")
        except Exception as e:
            raise Exception(f"Error habilitando proyecto: {str(e)}")

    def disable_project(self, project_id: str):
        """
        Detiene manualmente un proyecto. Marca `inactive` (distinto de
        `idle`) para que el wake-on-request no lo resucite a espaldas
        del usuario.
        """
        if project_id not in self.active_services:
            raise Exception(f"Proyecto '{project_id}' no encontrado")
        info = self.active_services[project_id]
        try:
            container = self.client.containers.get(info["container_id"])
            container.stop()
            info["status"] = "inactive"
            print(f"⏸️  Proyecto deshabilitado: {info['container_name']}")
        except Exception as e:
            raise Exception(f"Error deshabilitando proyecto: {str(e)}")

    def cleanup_all(self):
        """Limpia todos los proyectos al apagar la plataforma."""
        containers_to_remove = []

        for project_id, info in list(self.active_services.items()):
            try:
                container = self.client.containers.get(info["container_id"])
                containers_to_remove.append(container)
            except docker.errors.NotFound:
                pass
            except Exception as e:
                print(f"⚠️  Error obteniendo contenedor {project_id}: {e}")

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

        if not containers_to_remove:
            print("✅ No hay contenedores que limpiar")
            return

        print(f"🗑️  Eliminando {len(containers_to_remove)} contenedor(es)...")

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

        self.active_services.clear()
        print("✅ Limpieza completa")