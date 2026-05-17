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
    code: str
    language: str  # "python" | "javascript"
    description: str = ""  

@app.post("/api/services")
async def create_service(request: CreateServiceRequest):
    """Crea un nuevo microservicio."""
    try:
        # 1. Crear el contenedor
        service_info = docker_mgr.create_microservice(
            name=request.name,
            code=request.code,
            language=request.language,
            description=request.description
        )
        
        # 2. Agregar ruta en NGINX
        nginx_mgr.add_route(
            service_id=service_info["service_id"],
            container_name=service_info["container_name"],
            endpoint=f"{request.name}-{service_info['service_id']}"
        )
        
        return {
            "success": True,
            "service_id": service_info["service_id"],
            "endpoint": service_info["endpoint"],
            "message": f"Microservicio disponible en {service_info['endpoint']}"
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