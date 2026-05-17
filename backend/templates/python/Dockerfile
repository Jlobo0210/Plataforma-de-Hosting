FROM python:3.11-slim

WORKDIR /app

# Instala las dependencias del servidor una sola vez
RUN pip install --no-cache-dir fastapi uvicorn[standard]

# El código del usuario llega como variable de entorno USER_CODE
# El runner.py lo lee y levanta el servidor
COPY runner.py .

CMD ["python", "runner.py"]