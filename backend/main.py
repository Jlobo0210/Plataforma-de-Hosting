from fastapi import FastAPI, HTTPException, Header, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from docker_manager import DockerManager
from nginx_manager import NginxManager
import threading

docker_mgr = DockerManager()
nginx_mgr = NginxManager()

SUPPORTED_CONTAINER_TYPES = {"dockerfile"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    nginx_mgr.cleanup_all()
    docker_mgr.cleanup_all()
    docker_mgr.start_background_threads()
    yield
    print("🔄 Apagando plataforma, limpiando proyectos...")
    cleanup_thread = threading.Thread(target=_cleanup)
    cleanup_thread.start()
    cleanup_thread.join(timeout=30)
    print("✅ Plataforma apagada")


def _cleanup():
    nginx_mgr.cleanup_all()
    docker_mgr.cleanup_all()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_username(x_username: str | None = Header(default=None)) -> str:
    """
    Stub de autenticación.

    TODO(Roble): reemplazar por validación de un Bearer token contra el
    endpoint oficial de Roble y extraer el username de los claims.
    Mientras tanto, el frontend debe enviar el header `X-Username`.
    """
    if not x_username:
        raise HTTPException(status_code=401, detail="Falta header X-Username")
    return x_username


def _require_owner(project_id: str, username: str) -> dict:
    """Devuelve el proyecto si pertenece al usuario; si no, 403/404."""
    info = docker_mgr.active_services.get(project_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if info.get("username") != username:
        raise HTTPException(status_code=403, detail="No es tu proyecto")
    return info


class CreateProjectRequest(BaseModel):
    name: str
    repo_url: str
    container_type: str  # "dockerfile" (docker-compose pendiente)
    port: int
    description: str = ""
    root_path: str = "."
    env_content: str = ""


class UpdateEnvRequest(BaseModel):
    env_content: str = ""


@app.post("/api/projects")
async def create_project(
    request: CreateProjectRequest,
    username: str = Depends(get_username),
):
    """Despliega un nuevo proyecto desde un repositorio de GitHub."""
    if request.container_type not in SUPPORTED_CONTAINER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"container_type '{request.container_type}' no soportado. "
                f"Soportados: {sorted(SUPPORTED_CONTAINER_TYPES)}"
            ),
        )

    try:
        project_info = docker_mgr.deploy_project(
            name=request.name,
            username=username,
            repo_url=request.repo_url,
            container_type=request.container_type,
            port=request.port,
            description=request.description,
            root_path=request.root_path,
            env_content=request.env_content,
        )

        hostname = nginx_mgr.add_project_route(
            project_id=project_info["project_id"],
            project_name=request.name,
            username=username,
            container_name=project_info["container_name"],
            port=request.port,
        )

        url = f"http://{hostname}"
        project_id = project_info["project_id"]
        if project_id in docker_mgr.active_services:
            docker_mgr.active_services[project_id]["hostname"] = hostname
            docker_mgr.active_services[project_id]["url"] = url

        return {
            "success": True,
            "project_id": project_id,
            "hostname": hostname,
            "url": url,
            "message": f"Proyecto disponible en {url}",
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects")
async def list_projects(username: str = Depends(get_username)):
    """Lista los proyectos activos del usuario autenticado."""
    mine = {
        pid: info
        for pid, info in docker_mgr.active_services.items()
        if info.get("username") == username
    }
    return {"projects": mine}


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str, username: str = Depends(get_username)):
    """Obtiene un proyecto individual del usuario."""
    return _require_owner(project_id, username)


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, username: str = Depends(get_username)):
    """Elimina un proyecto y su contenedor."""
    _require_owner(project_id, username)
    docker_mgr.stop_project(project_id)
    nginx_mgr.remove_route(project_id)
    return {"success": True}


@app.patch("/api/projects/{project_id}/enable")
async def enable_project(project_id: str, username: str = Depends(get_username)):
    """Habilita un proyecto que el usuario detuvo manualmente."""
    _require_owner(project_id, username)
    try:
        docker_mgr.enable_project(project_id)
        return {"success": True, "status": "active"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/projects/{project_id}/disable")
async def disable_project(project_id: str, username: str = Depends(get_username)):
    """Detiene manualmente un proyecto sin eliminarlo."""
    _require_owner(project_id, username)
    try:
        docker_mgr.disable_project(project_id)
        return {"success": True, "status": "inactive"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/projects/{project_id}/env")
async def update_project_env(
    project_id: str,
    request: UpdateEnvRequest,
    username: str = Depends(get_username),
):
    """Actualiza las variables de entorno del proyecto recreando el contenedor."""
    _require_owner(project_id, username)
    try:
        docker_mgr.update_project_env(project_id, request.env_content)
        return docker_mgr.active_services[project_id]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/_wake/{project_id}", status_code=204)
async def wake(project_id: str):
    """
    Endpoint interno invocado por NGINX vía `auth_request` antes de cada
    proxy_pass al contenedor del proyecto. No requiere auth de usuario:
    NGINX lo llama desde la red interna `platform_network`.

    Comportamiento:
    - Refresca `last_active` (heartbeat).
    - Si el contenedor está apagado por inactividad (`idle`), lo arranca
      y espera a que esté listo antes de responder 204.
    - Si el proyecto no existe, 404 (la conf dinámica no debería existir
      si el proyecto fue eliminado, así que esto solo pasa en carreras).
    - Si el dueño lo apagó manualmente (`inactive`), 503 para no
      resucitarlo a sus espaldas.
    - Si el cold start falla, 500.

    NGINX `auth_request` solo aprueba 2xx; cualquier no-2xx aborta el
    proxy_pass y el cliente ve un error 500/401/403 según la regla.
    """
    try:
        docker_mgr.wake_project(project_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Proyecto desconocido")
    except PermissionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return Response(status_code=204)
