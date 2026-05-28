# Plataforma de Hosting Basada en Contenedores

> Repositorio: [GitHub](<LINK_REPOSITORIO_AQUÍ>)  
> Video de demostración: [YouTube](<LINK_VIDEO_AQUÍ>)

---

## Descripción

Plataforma de hosting web que permite a usuarios autenticados desplegar sus propios sitios desde un repositorio de GitHub, sin configurar servidores ni escribir comandos. El usuario proporciona la URL de su repositorio y la plataforma se encarga de clonar el código, construir la imagen Docker y exponer el sitio en un subdominio personalizado, todo en tiempo real.

Cada proyecto desplegado queda accesible en:
```
http://nombre-proyecto.usuario.localhost
```

### Funcionalidades principales

- Autenticación de usuarios mediante **Roble**
- Despliegue automático desde repositorios de **GitHub**
- Soporte para proyectos con **Dockerfile** y **Docker Compose**
- Subdominio único por proyecto: `proyecto.usuario.localhost`
- Enrutamiento dinámico mediante **NGINX** sin necesidad de reinicio
- Habilitar y deshabilitar proyectos sin eliminar el contenedor
- **Apagado automático** de contenedores inactivos por más de 30 minutos
- **Wake-on-request**: el contenedor se reactiva automáticamente al recibir una petición
- Límites de CPU y memoria por contenedor
- Rate limiting: máximo 60 peticiones por minuto por IP

---

## Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO                                  │
│              Navegador · proyecto.usuario.localhost             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND — React.js                             │
│                                                                  │
│  Dashboard · CreateProjectModal · ProjectCard · Auth            │
│  React Router · Tailwind CSS · Fetch API                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch /api/...
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NGINX — Reverse Proxy                           │
│                                                                  │
│  /api/projects  ─────────────────────► Backend :8000            │
│  proyecto.usuario.localhost  ────────► Contenedor del usuario   │
│                                                                  │
│  /_wake/{id} invocado antes de cada proxy_pass                  │
│  Rate limiting: 60 req/min por IP                               │
│  Recarga configuración dinámicamente desde volumen compartido    │
│                        puerto 80                                 │
└──────────────┬────────────────────────────────┬─────────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────────┐    ┌───────────────────────────────────┐
│  BACKEND — FastAPI        │    │  CONTENEDORES DE USUARIO          │
│                          │    │                                    │
│  main.py                 │    │  project-{user}-{name}-{id}        │
│  docker_manager.py       │    │                                    │
│  nginx_manager.py        │    │  Dockerfile → imagen construida    │
│  env_utils.py            │    │  Docker Compose → servicios        │
│                          │    │                                    │
│  POST   /api/projects    │    │  Límites: 256MB RAM · 0.5 CPUs     │
│  GET    /api/projects    │    │  Apagado automático: 30 min idle   │
│  DELETE /api/projects    │    │  Wake-on-request automático        │
│  PATCH  .../enable       │    │                                    │
│  PATCH  .../disable      │    └───────────────────────────────────┘
│  PATCH  .../env          │
│  GET    /_wake/{id}      │
│                          │
│  Autenticación: Roble    │
│  puerto 8000             │
└──────────┬───────────────┘
           │ /var/run/docker.sock
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    DOCKER ENGINE                                  │
│                                                                  │
│  Red interna: platform_network                                   │
│  Clona repositorio → construye imagen → lanza contenedor         │
└──────────────────────────────────────────────────────────────────┘

           ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
           Volumen compartido: nginx_locations
           Backend escribe .conf → NGINX los lee
           ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Docker Compose v2
- Cuenta en **Roble** para autenticarse en la plataforma

---

## Instalación y ejecución

```bash
# 1. Clonar el repositorio
git clone <LINK_REPOSITORIO_AQUÍ>
cd Plataforma-de-Hosting

# 2. Levantar todos los servicios
docker compose up --build

# 3. Abrir la aplicación en el navegador
# http://localhost
```

La primera vez puede tardar unos minutos mientras Docker construye las imágenes.

### Configuración de subdominios en Windows

Para acceder a los proyectos desplegados desde el navegador en Windows, es necesario registrar cada subdominio en el archivo `hosts`. Ábrelo como administrador desde:

```
C:\Windows\System32\drivers\etc\hosts
```

Y agrega una línea por cada proyecto:

```
127.0.0.1    nombre-proyecto.usuario.localhost
```

> En Linux y Mac esto no es necesario — los subdominios `*.localhost` se resuelven automáticamente.

---

## Cómo usar la plataforma

### 1. Iniciar sesión

Accede a `http://localhost` e inicia sesión con tu cuenta de **Roble**. Cada usuario tiene un espacio personal de proyectos.

### 2. Crear un proyecto

1. Haz clic en **"Nuevo Proyecto"**
2. Completa el formulario:
   - **Nombre:** identificador del proyecto (ej: `mi-web`)
   - **URL del repositorio:** dirección del repositorio en GitHub
   - **Tipo de contenedor:** `dockerfile` o `docker-compose`
   - **Puerto:** puerto que expone tu aplicación
   - **Descripción:** descripción breve del proyecto
3. Haz clic en **"Desplegar"**
4. La plataforma clona el repositorio, construye la imagen y lanza el contenedor automáticamente

El proyecto queda disponible en:
```
http://nombre-proyecto.usuario.localhost
```

### 3. Gestionar proyectos

Desde el dashboard puedes:

- **Habilitar / deshabilitar** un proyecto con el toggle — el contenedor se detiene pero no se elimina
- **Eliminar** un proyecto — detiene y elimina el contenedor e imagen
- **Actualizar variables de entorno** — reconstruye el contenedor con las nuevas variables

### 4. Apagado automático y wake-on-request

Los contenedores inactivos por más de **30 minutos** se apagan automáticamente para liberar recursos. Cuando el usuario vuelve a visitar el subdominio, la plataforma detecta la petición, reactiva el contenedor y redirige la solicitud de forma transparente.

---

## Requisitos del repositorio del usuario

Para que la plataforma pueda desplegar el proyecto, el repositorio debe cumplir:

**Para proyectos Dockerfile:**
- Tener un archivo `Dockerfile` en la raíz (o en la ruta indicada)
- El `Dockerfile` debe exponer el puerto que el usuario indicó al crear el proyecto

**Para proyectos Docker Compose:**
- Tener un archivo `docker-compose.yml` en la raíz (o en la ruta indicada)
- El servicio principal debe exponer el puerto indicado

---

## Estructura del proyecto

```
Plataforma-de-Hosting/
│
├── frontend/                        # Aplicación React
│   ├── src/
│   ├── Dockerfile                   # Imagen de producción
│   └── Dockerfile.dev               # Imagen de desarrollo con hot reload
│
├── backend/                         # API FastAPI
│   ├── main.py                      # Endpoints REST y autenticación Roble
│   ├── docker_manager.py            # Gestión de contenedores Docker
│   ├── nginx_manager.py             # Escritura de configuración NGINX
│   ├── env_utils.py                 # Utilidades para variables de entorno
│   ├── Dockerfile                   # Imagen de producción
│   ├── Dockerfile.dev               # Imagen de desarrollo con hot reload
│   └── templates/                   # Runners para microservicios (legado)
│       ├── python/
│       └── javascript/
│
├── nginx/
│   ├── nginx.conf                   # Configuración base con rate limiting
│   ├── reload_watch.sh              # Recarga NGINX al detectar cambios
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## Tecnologías utilizadas

| Capa | Tecnología | Rol |
|---|---|---|
| Frontend | React 18 | Interfaz de usuario |
| Frontend | React Router | Navegación entre páginas |
| Frontend | Tailwind CSS | Estilos |
| Frontend | Fetch API | Comunicación con el backend |
| Autenticación | Roble | Gestión de usuarios y sesiones |
| Proxy | NGINX | Reverse proxy, subdominios dinámicos y rate limiting |
| Backend | FastAPI | API REST principal |
| Backend | Docker SDK (Python) | Gestión de contenedores vía socket |
| Backend | python-on-whales | Soporte para proyectos Docker Compose |
| Backend | GitPython | Clonado de repositorios GitHub |
| Infraestructura | Docker | Contenedores aislados por proyecto |
| Infraestructura | Docker Compose | Orquestación de servicios de la plataforma |

---

## Endpoints del backend

| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/projects | Despliega un nuevo proyecto |
| GET | /api/projects | Lista los proyectos del usuario autenticado |
| GET | /api/projects/{id} | Obtiene un proyecto individual |
| DELETE | /api/projects/{id} | Elimina un proyecto y su contenedor |
| PATCH | /api/projects/{id}/enable | Habilita un proyecto detenido |
| PATCH | /api/projects/{id}/disable | Detiene un proyecto sin eliminarlo |
| PATCH | /api/projects/{id}/env | Actualiza variables de entorno |
| GET | /_wake/{id} | Endpoint interno — reactiva contenedores idle |
