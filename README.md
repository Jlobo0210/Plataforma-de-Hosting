# Plataforma de Hosting Basada en Contenedores

> Repositorio: [GitHub](<https://github.com/Jlobo0210/Plataforma-de-Hosting.git>)  
> Video de demostración: [YouTube](<https://youtu.be/-5rdpnjhAcI>)

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
   - **Ruta raíz** *(opcional):* carpeta dentro del repositorio donde está el `Dockerfile` o `docker-compose.yml`
   - **Variables de entorno** *(opcional):* contenido del `.env` que necesita tu aplicación
3. Haz clic en **"Desplegar"**
4. La plataforma clona el repositorio, construye la imagen y lanza el contenedor automáticamente

> **Ruta raíz y variables de entorno** son campos adicionales que agregamos para facilitar el despliegue de proyectos con estructura de monorepo o que requieran conexión a bases de datos y servicios externos.

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

---

## Documento técnico

### Descripción de la arquitectura y componentes

La plataforma está compuesta por cuatro servicios que se orquestan mediante Docker Compose y se comunican a través de una red interna llamada `platform_network`.

**Frontend** es una aplicación React que sirve la interfaz de usuario. Se comunica con el backend a través de NGINX y gestiona el estado de autenticación mediante tokens de Roble. No tiene acceso directo a Docker ni al backend — todo pasa por el proxy.

**NGINX** actúa como el punto de entrada único de la plataforma. Cumple tres funciones: enrutar las peticiones de la API hacia el backend, enrutar el tráfico de cada subdominio hacia el contenedor del usuario correspondiente, y aplicar rate limiting para proteger los recursos. Su configuración es dinámica — el backend escribe archivos `.conf` en un volumen compartido y NGINX los recarga automáticamente sin reiniciarse.

**Backend** es una API REST construida con FastAPI. Es el componente central del sistema: valida la autenticación con Roble, gestiona el ciclo de vida completo de los contenedores de usuario a través del Docker SDK, y mantiene en memoria el estado de todos los proyectos activos. Se conecta al Docker Engine del host mediante el socket `/var/run/docker.sock`, lo que le permite crear y destruir contenedores sin estar él mismo fuera de Docker.

**Contenedores de usuario** son instancias Docker creadas dinámicamente para cada proyecto. Cada contenedor ejecuta el sitio web del usuario en aislamiento total, con límites de CPU y memoria aplicados en el momento de su creación.

---

### Flujo de trabajo del sistema

**Despliegue de un proyecto:**

1. El usuario se autentica con Roble y obtiene un token JWT
2. Desde el dashboard envía un `POST /api/projects` con la URL del repositorio, tipo de contenedor y puerto
3. El backend valida el token con Roble y extrae el nombre de usuario del JWT
4. El backend clona el repositorio en una carpeta temporal usando GitPython
5. Construye la imagen Docker desde el `Dockerfile` o `docker-compose.yml` del repositorio
6. Lanza el contenedor en `platform_network` con límites de recursos aplicados
7. Escribe un archivo `.conf` en el volumen compartido con NGINX, definiendo el subdominio del proyecto
8. NGINX detecta el nuevo archivo y recarga su configuración automáticamente
9. El proyecto queda accesible en `http://nombre.usuario.localhost`

**Petición de un usuario a su proyecto:**

1. El navegador resuelve `nombre.usuario.localhost` → `127.0.0.1`
2. NGINX recibe la petición y antes de hacer proxy invoca `/_wake/{id}` en el backend
3. El backend registra la actividad del proyecto y verifica si el contenedor está activo
4. Si el contenedor estaba apagado por inactividad, lo reactiva y espera a que responda HTTP
5. NGINX hace proxy de la petición original hacia el contenedor del usuario
6. El usuario recibe la respuesta de su sitio web

**Apagado automático:**

Un hilo en segundo plano revisa cada 60 segundos todos los proyectos activos. Si un proyecto lleva más de 30 minutos sin recibir tráfico, el contenedor se detiene. El registro del proyecto se conserva en memoria, lo que permite el wake-on-request posterior.

---

### Estrategia de seguridad y optimización de recursos

**Autenticación y autorización**

Todos los endpoints de la API requieren un token Bearer válido emitido por Roble. El backend verifica el token en cada petición consultando el endpoint de verificación de Roble. Además, cada operación sobre un proyecto (eliminar, habilitar, deshabilitar, actualizar variables) verifica que el proyecto pertenezca al usuario autenticado — un usuario no puede operar sobre proyectos ajenos.

El endpoint `/_wake/{id}` es la única excepción: no requiere token de usuario porque es invocado internamente por NGINX desde la red `platform_network`, nunca desde el exterior.

**Aislamiento de contenedores**

Cada proyecto corre en su propio contenedor Docker con aislamiento completo de sistema de archivos, procesos y red. Los contenedores de usuario no tienen acceso al socket de Docker ni a la red del host — solo están conectados a `platform_network`, desde donde solo NGINX puede alcanzarlos.

**Límites de recursos por contenedor**

Cada contenedor se crea con restricciones fijas para evitar que un proyecto consuma recursos excesivos y afecte a otros usuarios:

- Memoria máxima: 256 MB
- CPU máxima: 0.5 núcleos (`nano_cpus=500_000_000`)

Si un contenedor supera el límite de memoria, Docker lo detiene automáticamente.

**Rate limiting**

NGINX aplica un límite de 60 peticiones por minuto por dirección IP para cada proyecto. Las peticiones que superan ese límite reciben una respuesta `429 Too Many Requests`. Esto protege los contenedores de usuario ante tráfico abusivo o ataques de fuerza bruta.

**Optimización de recursos — apagado automático**

Los contenedores inactivos por más de 30 minutos se apagan automáticamente mediante un hilo dedicado (`_idle_watcher`) que corre en segundo plano. Esto libera CPU y memoria del host para otros proyectos activos. El estado `idle` se distingue del estado `inactive` (apagado manualmente por el usuario) para que el wake-on-request no reactive proyectos que el usuario decidió detener deliberadamente.

**Limpieza al apagar la plataforma**

Al detener la plataforma con `docker compose down`, el backend ejecuta una limpieza ordenada en un hilo separado con un timeout de 30 segundos. Los proyectos Docker Compose se bajan con `compose down` para eliminar también sus redes internas. Los proyectos Dockerfile se detienen en paralelo para minimizar el tiempo de apagado.
