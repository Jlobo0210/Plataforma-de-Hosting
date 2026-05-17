# Plataforma Dinámica de Microservicios

> Repositorio: [GitHub](https://github.com/Jlobo0210/Plataforma-de-Microservicios.git)  
> Video de demostración: [YouTube](https://youtu.be/ol1uybySsB8)

---

## Descripción

Sistema que permite crear, desplegar y ejecutar microservicios en contenedores Docker de forma dinámica desde una interfaz web, sin necesidad de reiniciar ningún servicio ni modificar configuraciones manualmente.

El usuario escribe una función en **Python** o **JavaScript** directamente en el navegador. La plataforma toma ese código, construye un contenedor Docker con él, lo expone como un endpoint HTTP y permite ejecutarlo con parámetros personalizados, todo en tiempo real.

### Funcionalidades principales

- Crear microservicios pegando código fuente directamente en la interfaz web
- Soporte para **Python** y **JavaScript**
- Despliegue automático en contenedores Docker aislados
- Detección automática de parámetros de la función mediante análisis de código (AST / Acorn)
- Ejecución del microservicio con parámetros desde la UI y visualización del resultado
- Habilitar y deshabilitar servicios sin eliminar el contenedor
- Eliminación de contenedores desde la interfaz
- Enrutamiento dinámico mediante NGINX sin necesidad de reinicio

---

## Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO                                  │
│                    Navegador · localhost                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND — React.js                             │
│                                                                  │
│  Dashboard · ServiceDetail · CreateServiceModal · Sidebar        │
│  React Router · Tailwind CSS · Fetch API                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch /api/...
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NGINX — Reverse Proxy                           │
│                                                                  │
│  /api/services  ─────────────────────► Backend :8000            │
│  /api/services/{name}-{id}  ─────────► Contenedor :8080         │
│                                                                  │
│  Recarga configuración dinámicamente desde volumen compartido    │
│                        puerto 80                                 │
└──────────────┬────────────────────────────────┬─────────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────────┐    ┌───────────────────────────────────┐
│  BACKEND — FastAPI        │    │  CONTENEDORES DOCKER              │
│                          │    │                                    │
│  main.py                 │    │  ms-{name}-{id}  puerto 8080       │
│  docker_manager.py       │    │                                    │
│  nginx_manager.py        │    │  Python → runner.py (FastAPI)      │
│                          │    │  JavaScript → runner.js (Express)  │
│  POST   /api/services    │    │                                    │
│  GET    /api/services    │    │  Código inyectado como USER_CODE   │
│  DELETE /api/services    │    │  Función detectada automáticamente │
│  PATCH  .../enable       │    │  Expuesta en GET / y POST /        │
│  PATCH  .../disable      │    │                                    │
│  GET    .../params       │    └───────────────────────────────────┘
│                          │
│  puerto 8000             │
└──────────┬───────────────┘
           │ /var/run/docker.sock
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    DOCKER ENGINE                                  │
│                                                                  │
│  Red interna: platform_network                                   │
│  Imágenes base: ms-platform-python · ms-platform-javascript      │
│  Construidas una sola vez al iniciar el backend                  │
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

---

## Instalación y ejecución

```bash
# 1. Clonar el repositorio
git clone <LINK_REPOSITORIO_AQUÍ>
cd Plataforma-de-Microservicios

# 2. Levantar todos los servicios
docker compose up --build

# 3. Abrir la aplicación en el navegador
# http://localhost
```

La primera vez puede tardar unos minutos mientras Docker construye las imágenes base de Python y JavaScript.

---

## Cómo usar la plataforma

### 1. Crear un microservicio

1. Haz clic en **"Nuevo Servicio"** en la barra lateral o en el header
2. Completa el formulario:
   - **Nombre:** identificador único en minúsculas y guiones (ej: `mi-servicio`)
   - **Descripción:** explica brevemente qué hace
   - **Lenguaje:** Python o JavaScript
   - **Código:** pega la función directamente en el editor
3. Haz clic en **"Crear y desplegar"**
4. La tarjeta aparece en el dashboard con estado **Construyendo…** y cambia a **Activo** cuando el contenedor está listo

---

### 2. Ejecutar un microservicio

1. En el dashboard, haz clic sobre el **endpoint** de la tarjeta (ej: `/api/services/suma-c2dddd16`)
2. Se abre la página de detalle del servicio con:
   - El **código fuente** del microservicio
   - Los **parámetros** detectados automáticamente
   - El panel de **resultado**
3. Llena los parámetros y haz clic en **"Ejecutar"**
4. El resultado aparece en el panel derecho
```
┌─────────────────────────────────────────────────────┐
│  Nuevo Servicio                                     │
│    → nombre · descripción · lenguaje · código       │
│    → Crear y desplegar                              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Dashboard — tarjeta del servicio                   │
│    → Estado: Construyendo... → Activo               │
│    → Click en el endpoint                           │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Detalle del servicio                               │
│    → Ver código fuente                              │
│    → Llenar parámetros (si los hay)                 │
│    → Ejecutar                                       │
│    → Ver resultado                                  │
└─────────────────────────────────────────────────────┘
```
---

## Ejemplos listos para usar
 
Copia y pega cualquiera de estos en el formulario de creación.
 
### Hola Mundo — Python
 
**Nombre:** `hola` · **Lenguaje:** Python
 
```python
def hola():
    return "Hola Mundo"
```
 
### Hola Mundo — JavaScript
 
**Nombre:** `hola` · **Lenguaje:** JavaScript
 
```javascript
function hola() {
    return "Hola Mundo";
}
```
 
### Suma — Python
 
**Nombre:** `suma` · **Lenguaje:** Python
 
```python
def suma(a, b):
    return float(a) + float(b)
```
 
### Suma — JavaScript
 
**Nombre:** `suma` · **Lenguaje:** JavaScript
 
```javascript
function suma(a, b) {
  return parseFloat(a) + parseFloat(b);
}
```

### Calcular IMC — Python

**Nombre:** `imc` · **Lenguaje:** Python

```python
def imc(peso, altura):
    resultado = float(peso) / (float(altura) ** 2)
    return round(resultado, 2)
```

### Celsius a Fahrenheit — JavaScript

**Nombre:** `temperatura` · **Lenguaje:** JavaScript

```javascript
function temperatura(celsius) {
  return (parseFloat(celsius) * 9) / 5 + 32;
}
```

---

## Estructura del proyecto

```
Plataforma-de-Microservicios/
│
├── frontend/                        # Aplicación React
│   ├── src/
│   │   ├── components/
│   │   │   ├── CodeEditor.jsx       # Editor con numeración de líneas
│   │   │   ├── CreateServiceModal.jsx
│   │   │   ├── ServiceCard.jsx      # Tarjeta de cada microservicio
│   │   │   ├── Sidebar.jsx
│   │   │   └── StatusBadge.jsx
│   │   ├── pages/
│   │   │   ├── App.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── ServiceDetail.jsx    # Página de ejecución del servicio
│   │   └── services/
│   │       └── api.js               # Capa de comunicación con el backend
│   ├── Dockerfile                   # Imagen de producción
│   └── Dockerfile.dev               # Imagen de desarrollo con hot reload
│
├── backend/                         # API FastAPI
│   ├── main.py                      # Endpoints REST
│   ├── docker_manager.py            # Gestión de contenedores Docker
│   ├── nginx_manager.py             # Escritura de configuración NGINX
│   ├── Dockerfile.dev               # Imagen de desarrollo con hot reload
│   └── templates/
│       ├── python/
│       │   ├── Dockerfile           # Imagen base para microservicios Python
│       │   └── runner.py            # Servidor que ejecuta el código Python
│       └── javascript/
│           ├── Dockerfile           # Imagen base para microservicios JavaScript
│           └── runner.js            # Servidor que ejecuta el código JavaScript
│
├── nginx/
│   ├── nginx.conf
│   ├── reload_watch.sh
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## Tecnologías utilizadas

| Capa            | Tecnología          | Rol                                     |
| --------------- | ------------------- | --------------------------------------- |
| Frontend        | React 18            | Interfaz de usuario                     |
| Frontend        | React Router        | Navegación entre páginas                |
| Frontend        | Tailwind CSS        | Estilos                                 |
| Frontend        | Fetch API           | Comunicación con el backend             |
| Proxy           | NGINX               | Reverse proxy y enrutamiento dinámico   |
| Backend         | FastAPI             | API REST principal                      |
| Backend         | Docker SDK (Python) | Gestión de contenedores                 |
| Runtime Python  | FastAPI + Uvicorn   | Servidor dentro del contenedor          |
| Runtime JS      | Express.js          | Servidor dentro del contenedor          |
| Runtime JS      | Acorn               | Parser AST para JavaScript              |
| Infraestructura | Docker              | Contenedores aislados por microservicio |
| Infraestructura | Docker Compose      | Orquestación de servicios               |
