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
    # Limpiar microservicios huérfanos
    nginx_mgr.cleanup_all()
    docker_mgr.cleanup_all()
    docker_mgr._start_monitor()
    yield
    # Al apagar: limpiar todo
    print("🔄 Apagando plataforma, limpiando microservicios...")
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

class CreateServiceRequest(BaseModel):
    name: str
    username: str
    code: str
    language: str  # "python" | "javascript"
    port: int = 8080
    description: str = ""

@app.post("/api/services")
async def create_service(request: CreateServiceRequest):
    """Crea un nuevo proyecto y lo publica en {name}.{username}.localhost."""
    try:
        service_info = docker_mgr.create_microservice(
            name=request.name,
            code=request.code,
            language=request.language,
            description=request.description
        )

        hostname = nginx_mgr.add_project_route(
            project_id=service_info["service_id"],
            project_name=request.name,
            username=request.username,
            container_name=service_info["container_name"],
            port=request.port,
        )

        url = f"http://{hostname}"
        service_id = service_info["service_id"]
        if service_id in docker_mgr.active_services:
            docker_mgr.active_services[service_id]["hostname"] = hostname
            docker_mgr.active_services[service_id]["url"] = url
            docker_mgr.active_services[service_id]["username"] = request.username
            docker_mgr.active_services[service_id]["port"] = request.port

        return {
            "success": True,
            "service_id": service_info["service_id"],
            "hostname": hostname,
            "url": url,
            "message": f"Proyecto disponible en {url}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/services/{service_id}")
async def delete_service(service_id: str):
    """Elimina un microservicio."""
    docker_mgr.stop_microservice(service_id)
    nginx_mgr.remove_route(service_id)
    return {"success": True}

@app.patch("/api/services/{service_id}/enable")
async def enable_service(service_id: str):
    # Habilita un microservicio detenido.
    try:
        docker_mgr.enable_microservice(service_id)
        return {"success": True, "status": "active"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.patch("/api/services/{service_id}/disable")
async def disable_service(service_id: str):
    # Deshabilita un microservicio sin eliminarlo.
    try:
        docker_mgr.disable_microservice(service_id)
        return {"success": True, "status": "inactive"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/services")
async def list_services():
    """Lista los microservicios activos."""
    return {"services": docker_mgr.active_services}

@app.get("/api/services/{service_id}/params")
async def get_service_params(service_id: str):
    """Retorna los parámetros que necesita un microservicio."""
    try:
        params = docker_mgr.get_service_params(service_id)
        return params
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))