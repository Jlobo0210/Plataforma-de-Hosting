from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from docker_manager import DockerManager
from nginx_manager import NginxManager
import threading

docker_mgr = DockerManager()
nginx_mgr = NginxManager()

# Limpieza al iniciar y apagar
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Al iniciar: limpiar microservicios huérfanos
    nginx_mgr.cleanup_all()
    docker_mgr.cleanup_all()
    yield
    # Al apagar: limpiar todo
    print("🔄 Apagando plataforma, limpiando microservicios...")
    cleanup_thread = threading.Thread(target=_cleanup)
    cleanup_thread.start()
    cleanup_thread.join(timeout=30)  # Espera hasta 30 segundos para limpiar
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

class CreateProjectRequest(BaseModel):
    name: str
    repo_url: str    # URL del repositorio de GitHub
    container_type: str  # "dockerfile" o "docker-compose"
    port: int        # Puerto que el microservicio expondrá
    description: str = ""  # Opcional, para futuras mejoras

@app.post("/api/projects")
async def create_project(request: CreateProjectRequest, username: str = "testuser"): # Temporal, el username vendría del token de autenticación Roble
    """Despliega un nuevo proyecto desde un repositorio de GitHub"""
    try:
        # 1. Crear el contenedor
        project_info = docker_mgr.deploy_project(
            name=request.name,
            username=username,
            repo_url=request.repo_url,
            container_type=request.container_type,
            port=request.port,
            description=request.description
        )
        
        # 2. Agregar ruta en NGINX
        nginx_mgr.add_route(
            service_id=project_info["project_id"],
            container_name=project_info["container_name"],
            endpoint=f"{request.name}.{username}"
        )
        
        return {
            "success": True,
            "project_id": project_info["project_id"],
            "endpoint": project_info["endpoint"],
            "message": f"Proyecto disponible en {project_info['endpoint']}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects")
async def list_projects():
    """Lista todos los proyectos activos."""
    return {"projects": docker_mgr.active_services}

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Elimina un proyecto y su contenedor."""
    docker_mgr.stop_project(project_id)
    nginx_mgr.remove_route(project_id)
    return {"success": True}

@app.patch("/api/projects/{project_id}/enable")
async def enable_project(project_id: str):
    """Habilita un proyecto detenido."""
    try:
        docker_mgr.enable_project(project_id)
        return {"success": True, "status": "active"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/projects/{project_id}/disable")
async def disable_project(project_id: str):
    """Deshabilita un proyecto sin eliminarlo."""
    try:
        docker_mgr.disable_project(project_id)
        return {"success": True, "status": "inactive"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))